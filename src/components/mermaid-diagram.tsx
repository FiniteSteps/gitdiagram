"use client";

import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";
// Remove the direct import
// import svgPanZoom from "svg-pan-zoom";

interface MermaidChartProps {
  chart: string;
  zoomingEnabled?: boolean;
}

const MermaidChart = ({ chart, zoomingEnabled = true }: MermaidChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: "base",
      htmlLabels: true,
      flowchart: {
        htmlLabels: true,
        curve: "basis",
        nodeSpacing: 50,
        rankSpacing: 50,
        padding: 15,
      },
      themeVariables: isDark
        ? {
            background: "#1f2631",
            primaryColor: "#2c3544",
            primaryBorderColor: "#6dd4e9",
            primaryTextColor: "#e8edf5",
            lineColor: "#ffd486",
            secondaryColor: "#26303f",
            tertiaryColor: "#323d4d",
          }
        : {
            background: "#ffffff",
            primaryColor: "#f7f7f7",
            primaryBorderColor: "#000000",
            primaryTextColor: "#171717",
            lineColor: "#000000",
            secondaryColor: "#f0f0f0",
            tertiaryColor: "#f7f7f7",
          },
      themeCSS: `
        .clickable {
          transition: transform 0.2s ease;
        }
        .clickable:hover {
          transform: scale(1.05);
          cursor: pointer;
        }
        .clickable:hover > * {
          filter: brightness(0.85);
        }
      `,
    });

    const initializePanZoom = async () => {
      const svgElement = containerRef.current?.querySelector("svg");
      if (svgElement && zoomingEnabled) {
        // Remove any max-width constraints
        svgElement.style.maxWidth = "none";
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";

        if (zoomingEnabled) {
          try {
            // Dynamically import svg-pan-zoom only when needed in the browser
            const svgPanZoom = (await import("svg-pan-zoom")).default;
            svgPanZoom(svgElement, {
              zoomEnabled: true,
              controlIconsEnabled: true,
              fit: true,
              center: true,
              minZoom: 0.1,
              maxZoom: 10,
              zoomScaleSensitivity: 0.3,
            });
          } catch (error) {
            console.error("Failed to load svg-pan-zoom:", error);
          }
        }
      }
    };

    const mermaidElement = containerRef.current?.querySelector(".mermaid");
    if (mermaidElement) {
      mermaidElement.removeAttribute("data-processed");
      mermaidElement.innerHTML = chart;
    }

    const renderMermaid = async () => {
      await mermaid.run({ querySelector: ".mermaid" });
      await initializePanZoom();
    };
    void renderMermaid();

    return () => {
      // Cleanup not needed with dynamic import approach
    };
  }, [chart, zoomingEnabled, isDark]); // Added zoomingEnabled to dependencies

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-full p-4 ${zoomingEnabled ? "h-[600px]" : ""}`}
    >
      <div
        key={`${chart}-${zoomingEnabled}-${resolvedTheme ?? "light"}`}
        className={`mermaid h-full text-foreground ${
          zoomingEnabled
            ? "rounded-lg border-2 border-black bg-white dark:border-[#3b4656] dark:bg-[#1f2631]"
            : ""
        }`}
      >
        {chart}
      </div>
    </div>
  );
};

export default MermaidChart;
