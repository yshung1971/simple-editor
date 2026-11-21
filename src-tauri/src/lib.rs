use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MAX_FILE_SIZE: u64 = 32 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TextFilePayload {
    path: String,
    name: String,
    content: String,
}

fn command_error(context: &str, error: impl std::fmt::Display) -> String {
    format!("{context}: {error}")
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
fn startup_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|argument| !argument.starts_with('-'))
        .filter_map(|argument| fs::canonicalize(argument).ok())
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            save_session,
            load_session,
            save_settings,
            load_settings,
            startup_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Editor");
}

