use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

const MAX_FILE_SIZE: u64 = 32 * 1024 * 1024;
const APP_IDENTIFIER: &str = "com.yshung.simpleeditor";
const SINGLE_INSTANCE_FILES_EVENT: &str = "single-instance-files-pending";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TextFilePayload {
    path: String,
    name: String,
    content: String,
}

#[derive(Default)]
struct PendingInstanceFiles(Mutex<Vec<String>>);

fn command_error(context: &str, error: impl std::fmt::Display) -> String {
    format!("{context}: {error}")
}

fn single_instance_enabled() -> bool {
    let Some(app_data) = std::env::var_os("APPDATA") else {
        return false;
    };
    let settings_path = PathBuf::from(app_data)
        .join(APP_IDENTIFIER)
        .join("settings.json");
    let Ok(content) = fs::read_to_string(settings_path) else {
        return false;
    };
    let Ok(settings) = serde_json::from_str::<serde_json::Value>(&content) else {
        return false;
    };

    settings
        .pointer("/behavior/instanceMode")
        .and_then(serde_json::Value::as_str)
        == Some("single")
}

fn canonical_file_arguments<I>(arguments: I, cwd: Option<&Path>) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    arguments
        .into_iter()
        .filter(|argument| !argument.starts_with('-'))
        .filter_map(|argument| {
            let path = PathBuf::from(argument);
            let candidate = if path.is_absolute() {
                path
            } else if let Some(cwd) = cwd {
                cwd.join(path)
            } else {
                path
            };
            let canonical = fs::canonicalize(candidate).ok()?;
            canonical
                .is_file()
                .then(|| canonical.to_string_lossy().into_owned())
        })
        .collect()
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn queue_instance_files(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingInstanceFiles>().0.lock() {
        pending.extend(paths);
    }
    let _ = app.emit(SINGLE_INSTANCE_FILES_EVENT, ());
}

fn session_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| command_error("Could not resolve app data directory", error))?;
    fs::create_dir_all(&directory)
        .map_err(|error| command_error("Could not create app data directory", error))?;
    Ok(directory.join("workspace-session.json"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| command_error("Could not resolve app data directory", error))?;
    fs::create_dir_all(&directory)
        .map_err(|error| command_error("Could not create app data directory", error))?;
    Ok(directory.join("settings.json"))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<TextFilePayload, String> {
    let canonical = fs::canonicalize(&path)
        .map_err(|error| command_error(&format!("Could not access {path}"), error))?;
    let metadata = fs::metadata(&canonical)
        .map_err(|error| command_error(&format!("Could not inspect {path}"), error))?;

    if !metadata.is_file() {
        return Err(format!("{path} is not a regular file"));
    }
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "{} is larger than the {} MB text-file limit",
            canonical.display(),
            MAX_FILE_SIZE / 1024 / 1024
        ));
    }

    let content = fs::read_to_string(&canonical)
        .map_err(|error| command_error("Could not read file as UTF-8 text", error))?;
    let name = canonical
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("untitled")
        .to_string();

    Ok(TextFilePayload {
        path: canonical.to_string_lossy().into_owned(),
        name,
        content,
    })
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let target = Path::new(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| command_error("Could not create destination folder", error))?;
    }
    fs::write(target, content)
        .map_err(|error| command_error("Could not write UTF-8 text file", error))
}

#[tauri::command]
fn save_session(app: AppHandle, content: String) -> Result<(), String> {
    let path = session_path(&app)?;
    fs::write(&path, content)
        .map_err(|error| command_error("Could not persist editor workspace", error))
}

#[tauri::command]
fn load_session(app: AppHandle) -> Result<Option<String>, String> {
    let path = session_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|error| command_error("Could not restore editor workspace", error))
}

#[tauri::command]
fn save_settings(app: AppHandle, content: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    fs::write(&path, content)
        .map_err(|error| command_error("Could not persist editor settings", error))
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|error| command_error("Could not restore editor settings", error))
}

#[tauri::command]
fn prepare_settings_file(app: AppHandle, content: String) -> Result<TextFilePayload, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        fs::write(&path, content)
            .map_err(|error| command_error("Could not initialize settings file", error))?;
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| command_error("Could not read settings file", error))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("settings.json")
        .to_string();

    Ok(TextFilePayload {
        path: path.to_string_lossy().into_owned(),
        name,
        content,
    })
}

#[tauri::command]
fn rename_text_file(path: String, new_name: String) -> Result<String, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("The new file name cannot be empty".to_string());
    }
    if trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("The new file name cannot contain path separators".to_string());
    }

    let canonical = fs::canonicalize(&path)
        .map_err(|error| command_error(&format!("Could not access {path}"), error))?;
    if !canonical.is_file() {
        return Err(format!("{path} is not a regular file"));
    }

    let parent = canonical
        .parent()
        .ok_or_else(|| format!("Could not resolve parent folder for {path}"))?;
    let target = parent.join(trimmed);
    if target.exists() {
        return Err(format!("{} already exists", target.display()));
    }

    fs::rename(&canonical, &target)
        .map_err(|error| command_error("Could not rename file", error))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
fn startup_files() -> Vec<String> {
    let cwd = std::env::current_dir().ok();
    canonical_file_arguments(std::env::args().skip(1), cwd.as_deref())
}

#[tauri::command]
fn take_pending_instance_files(
    state: tauri::State<'_, PendingInstanceFiles>,
) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut pending| std::mem::take(&mut *pending))
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(PendingInstanceFiles::default());
    let builder = if single_instance_enabled() {
        builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            focus_main_window(app);
            let paths = canonical_file_arguments(
                argv.into_iter().skip(1),
                Some(Path::new(&cwd)),
            );
            queue_instance_files(app, paths);
        }))
    } else {
        builder
    };

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            save_session,
            load_session,
            save_settings,
            load_settings,
            prepare_settings_file,
            rename_text_file,
            startup_files,
            take_pending_instance_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Editor");
}

