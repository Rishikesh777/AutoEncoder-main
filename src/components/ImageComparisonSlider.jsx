import React, { useState, useRef, useCallback } from "react";
import { Box, Typography } from "@mui/material";

const ImageComparisonSlider = ({ originalSrc, watermarkedSrc }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef(null);
    const isDragging = useRef(false);

    const updateSlider = useCallback((clientX) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        setSliderPos((x / rect.width) * 100);
    }, []);

    const onMouseDown = () => { isDragging.current = true; };
    const onMouseMove = (e) => { if (isDragging.current) updateSlider(e.clientX); };
    const onMouseUp = () => { isDragging.current = false; };
    const onTouchMove = (e) => { updateSlider(e.touches[0].clientX); };

    return (
        <Box sx={{ mt: 2, mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#00d4ff", boxShadow: "0 0 8px #00d4ff" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#00d4ff", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.8rem" }}>
                    Visual Comparison — Slide to Check Quality
                </Typography>
            </Box>
            <Box
                ref={containerRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchMove={onTouchMove}
                onTouchEnd={onMouseUp}
                sx={{
                    position: "relative",
                    width: "100%",
                    maxHeight: 450,
                    overflow: "hidden",
                    borderRadius: "20px",
                    border: "1px solid rgba(0, 212, 255, 0.25)",
                    cursor: "ew-resize",
                    userSelect: "none",
                    boxShadow: "0 0 30px rgba(0, 212, 255, 0.08)",
                    bgcolor: "#000",
                    lineHeight: 0,
                }}
            >
                {/* Watermarked (right / base layer) */}
                <Box
                    component="img"
                    src={watermarkedSrc}
                    alt="Watermarked"
                    sx={{ width: "100%", maxHeight: 450, objectFit: "contain", display: "block" }}
                    draggable={false}
                />

                {/* Original (left / clipped layer) */}
                <Box
                    component="img"
                    src={originalSrc}
                    alt="Original"
                    draggable={false}
                    sx={{
                        position: "absolute",
                        top: 0, left: 0,
                        width: "100%",
                        maxHeight: 450,
                        objectFit: "contain",
                        display: "block",
                        clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                    }}
                />

                {/* Divider line */}
                <Box sx={{
                    position: "absolute",
                    top: 0, bottom: 0,
                    left: `${sliderPos}%`,
                    width: "2px",
                    bgcolor: "#00d4ff",
                    boxShadow: "0 0 12px rgba(0,212,255,0.8)",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                }} />

                {/* Drag handle circle */}
                <Box sx={{
                    position: "absolute",
                    top: "50%",
                    left: `${sliderPos}%`,
                    transform: "translate(-50%, -50%)",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "#00d4ff",
                    boxShadow: "0 0 16px rgba(0,212,255,0.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                }}>
                    <Typography sx={{ color: "#020c1b", fontWeight: 900, fontSize: "0.75rem", letterSpacing: "-1px" }}>{"◀▶"}</Typography>
                </Box>

                {/* Labels */}
                <Box sx={{ position: "absolute", top: 10, left: 12, bgcolor: "rgba(2,12,27,0.75)", px: 1.2, py: 0.4, borderRadius: "8px", backdropFilter: "blur(4px)" }}>
                    <Typography sx={{ color: "#e6f1ff", fontSize: "0.72rem", fontWeight: 700 }}>ORIGINAL</Typography>
                </Box>
                <Box sx={{ position: "absolute", top: 10, right: 12, bgcolor: "rgba(0,212,255,0.15)", px: 1.2, py: 0.4, borderRadius: "8px", border: "1px solid rgba(0,212,255,0.3)", backdropFilter: "blur(4px)" }}>
                    <Typography sx={{ color: "#00d4ff", fontSize: "0.72rem", fontWeight: 700 }}>WATERMARKED</Typography>
                </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1.5 }}>
                Slide to compare original vs. watermarked medical image side-by-side
            </Typography>
        </Box>
    );
};

export default ImageComparisonSlider;
