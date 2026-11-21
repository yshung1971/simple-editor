import { RotateCcw, Scan, ZoomIn, ZoomOut } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import type { ThemeMode } from "../types";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const ACCENT_COUNT = 8;
const BASE_NODE_CLASSES = new Set(["node", "default"]);

type MermaidDiagramProps = {
  chart: string;
  themeMode: ThemeMode;
};

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function fitWidth(width: number, availableWidth: number) {
  if (!width || !availableWidth) {
    return 1;
  }
  return clampZoom(Math.min(1, availableWidth / width));
}

function applyAccentPalette(svg: SVGSVGElement) {
  const nodes = svg.querySelectorAll<SVGGElement>("g.node");

  nodes.forEach((node, index) => {
    const hasCustomClass = [...node.classList].some(
      (className) => !BASE_NODE_CLASSES.has(className),
    );
    if (hasCustomClass) {
      return;
    }

    node.classList.add(`simple-mermaid-accent-${index % ACCENT_COUNT}`);
  });
}

export function MermaidDiagram({
  chart,
  themeMode,
}: MermaidDiagramProps) {
  const reactId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;

    async function renderDiagram() {
      if (!host) {
        return;
      }

      setStatus("loading");
      setErrorMessage("");

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: themeMode === "dark" ? "dark" : "default",
          fontFamily:
            '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
        });

        const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, chart);
        if (cancelled) {
          return;
        }

        host.innerHTML = svg;
        const svgElement = host.querySelector("svg");
        if (!svgElement) {
          throw new Error("Mermaid returned an empty diagram");
        }
        applyAccentPalette(svgElement);

        const viewBox = svgElement.viewBox.baseVal;
        const bounds = svgElement.getBoundingClientRect();
        const width = viewBox.width || bounds.width || 800;
        const height = viewBox.height || bounds.height || 600;
        naturalSizeRef.current = { width, height };

        const availableWidth = Math.max(
          120,
          (viewportRef.current?.clientWidth ?? width) - 32,
        );
        const initialZoom = fitWidth(width, availableWidth);
        setFitZoom(initialZoom);
        setZoom(initialZoom);

        svgElement.removeAttribute("height");
        svgElement.style.maxWidth = "none";
        svgElement.style.width = `${width * initialZoom}px`;
        svgElement.style.height = "auto";
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : String(error),
          );
          setStatus("error");
        }
      }
    }

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId, themeMode]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateFitZoom = () => {
      const { width } = naturalSizeRef.current;
      setFitZoom(fitWidth(width, Math.max(120, viewport.clientWidth - 32)));
    };

    const observer = new ResizeObserver(updateFitZoom);
    observer.observe(viewport);
    updateFitZoom();
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => {
    const svgElement = hostRef.current?.querySelector("svg");
    if (!svgElement || status !== "ready") {
      return;
    }

    const { width } = naturalSizeRef.current;
    svgElement.style.width = `${width * zoom}px`;
    svgElement.style.height = "auto";
  }, [status, zoom]);

  const adjustZoom = (direction: -1 | 1) => {
    setZoom((current) =>
      clampZoom(
        Math.round((current + direction * ZOOM_STEP) * 100) / 100,
      ),
    );
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    adjustZoom(event.deltaY > 0 ? -1 : 1);
  };

  return (
    <div className="mermaid-block" data-mermaid-block="true">
      <div className="mermaid-toolbar" aria-label="Diagram zoom controls">
        <button
          type="button"
          onClick={() => adjustZoom(-1)}
          disabled={zoom <= MIN_ZOOM || status !== "ready"}
          title="Zoom out"
          aria-label="Zoom diagram out"
        >
          <ZoomOut size={14} strokeWidth={1.8} />
        </button>
        <span className="mermaid-zoom-value">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => adjustZoom(1)}
          disabled={zoom >= MAX_ZOOM || status !== "ready"}
          title="Zoom in"
          aria-label="Zoom diagram in"
        >
          <ZoomIn size={14} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(fitZoom)}
          disabled={status !== "ready"}
          title="Fit diagram to width"
          aria-label="Fit diagram to width"
        >
          <Scan size={14} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          disabled={status !== "ready"}
          title="Reset diagram to 100%"
          aria-label="Reset diagram zoom to 100 percent"
        >
          <RotateCcw size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div
        className="mermaid-viewport"
        ref={viewportRef}
        onWheel={handleWheel}
        aria-busy={status === "loading"}
      >
        {status === "loading" ? (
          <div className="mermaid-status">Rendering diagram...</div>
        ) : null}
        {status === "error" ? (
          <div className="mermaid-error" role="alert">
            <strong>Mermaid error</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}
        <div
          className="mermaid-canvas"
          ref={hostRef}
          role="img"
          aria-label="Mermaid diagram"
          hidden={status !== "ready"}
        />
      </div>
    </div>
  );
}
