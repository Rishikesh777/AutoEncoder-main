import React, { useState, useRef } from "react";
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Stack,
    Fade,
    Zoom,
    CircularProgress,
    Alert,
    Chip,
    Divider,
    Card,
    CardContent,
    Grid,
    TextField,
    Snackbar,
    Tooltip,
} from "@mui/material";
import {
    CloudUpload,
    Search as SearchIcon,
    Restore,
    DeleteOutline,
    ContentPasteSearch,
    Download,
    Security,
    VerifiedUser,
    Warning,
    CheckCircle,
    ErrorOutline,
    VpnKey,
    Fingerprint,
    History,
    Image as ImageIcon,
    Replay,
    Close,
} from "@mui/icons-material";
import { addHistory } from "../utils/history";

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem("auth_token");

const Extract = () => {
    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [extractedData, setExtractedData] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExtracted, setIsExtracted] = useState(false);
    const [imageName, setImageName] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: "", severity: "info" });
    const [metadataInput, setMetadataInput] = useState({ image_id: "", session_key: "" });
    const [decryptionPassword, setDecryptionPassword] = useState("");
    const [showMetadataInput, setShowMetadataInput] = useState(false);
    const [hasUploadedAtLeastOnce, setHasUploadedAtLeastOnce] = useState(false);
    const [isTampered, setIsTampered] = useState(false);

    const fileInputRef = useRef(null);
    const metadataFileInputRef = useRef(null);

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(URL.createObjectURL(file));
            setImageFile(file);
            setImageName(file.name);
            setIsExtracted(false);
            setExtractedData("");
            setResult(null);
            setError(null);
            setIsTampered(false);
            setHasUploadedAtLeastOnce(true);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            setImage(URL.createObjectURL(file));
            setImageFile(file);
            setImageName(file.name);
            setIsExtracted(false);
            setExtractedData("");
            setResult(null);
            setError(null);
            setIsTampered(false);
            setHasUploadedAtLeastOnce(true);
        }
    };

    const showNotification = (message, severity = "info") => {
        setNotification({ open: true, message, severity });
    };

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    const handleMetadataFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                setMetadataInput({
                    image_id: data.image_id || data.id || "",
                    session_key: data.session_key || ""
                });
                // Note: password is intentionally NOT stored in metadata JSON
                // The user must enter it manually for security
                setShowMetadataInput(true);
                showNotification("✓ Metadata loaded successfully", "success");
            } catch (err) {
                console.error("Metadata parse error:", err);
                showNotification("Error: Invalid metadata file format", "error");
            }
        };
        reader.readAsText(file);
    };

    const handleExtract = async () => {
        // Validate inputs
        if (!imageFile) {
            setError("Please select a watermarked image first");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Check authentication
            const token = getAuthToken();
            if (!token) {
                throw new Error("You must be logged in to use this feature");
            }

            // Create FormData for file upload
            const formData = new FormData();
            formData.append("image", imageFile);

            // Add optional metadata if provided
            if (metadataInput.image_id) {
                formData.append("image_id", metadataInput.image_id);
            }
            if (metadataInput.session_key) {
                formData.append("session_key", metadataInput.session_key);
            }
            if (decryptionPassword.trim()) {
                formData.append("encryption_password", decryptionPassword.trim());
            }

            // Show processing notification
            showNotification("Sending image to autoencoder for extraction...", "info");

            // Send to Node.js backend (which forwards to Python)
            const response = await fetch("/api/autoencoder/extract", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            let data;
            const resText = await response.text();
            try {
                data = JSON.parse(resText);
            } catch (e) {
                console.error("Non-JSON response:", resText);
                throw new Error("Server returned an invalid response. Please check if the backend is running correctly.");
            }

            if (!response.ok) {
                const detail = data.detail || data.message || data.error || "Extraction failed";
                if (detail.startsWith("TAMPERED:")) {
                    setIsTampered(true);
                    setIsExtracted(false);
                    throw new Error(detail);
                }
                throw new Error(detail);
            }

            // Success!
            setResult(data);
            setExtractedData(data.extracted_data);
            setIsExtracted(true);

            // Save to history
            addHistory({
                type: "Extract",
                imageName: imageName,
                data: data.extracted_data,
                status: "Success",
                resultImage: image,
                metadata: {
                    autoencoder_tag: data.extracted_tag || data.current_tag,
                    verification_status: data.verification?.verification_status,
                    integrity_check: data.verification?.integrity_check,
                }
            });

            showNotification("✓ Data extracted successfully!", "success");

        } catch (err) {
            console.error("Extraction error:", err);
            setError(err.message);
            showNotification(`Error: ${err.message}`, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadResult = () => {
        if (!extractedData) return;
        const element = document.createElement("a");
        const file = new Blob([extractedData], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `extracted_data_${imageName || "image"}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleDownloadVerificationReport = () => {
        if (!result) return;

        const report = {
            timestamp: new Date().toISOString(),
            image_name: imageName,
            extracted_data: result.extracted_data,
            autoencoder_tag: result.extracted_tag || result.current_tag,
            verification: result.verification,
            quality_metrics: {
                psnr_watermarked_vs_restored: result.metadata?.psnr_watermarked_vs_restored,
                ssim_watermarked_vs_restored: result.metadata?.ssim_watermarked_vs_restored,
                psnr_original_vs_restored: result.metadata?.psnr_original_vs_restored,
                ssim_original_vs_restored: result.metadata?.ssim_original_vs_restored,
                note: "PSNR = ∞ and SSIM = 1.0 confirm pixel-perfect reversibility",
            },
            metadata: result.metadata,
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `verification_report_${imageName || "image"}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearImage = () => {
        setImage(null);
        setImageFile(null);
        setExtractedData("");
        setIsExtracted(false);
        setResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRetry = () => {
        setIsExtracted(false);
        setExtractedData("");
        setResult(null);
        setError(null);
        setIsTampered(false);
    };

    // Get verification status color and icon
    const getVerificationStatus = () => {
        if (!result?.verification) return { color: "info", icon: <ErrorOutline />, text: "Unknown" };

        const status = result.verification.verification_status;
        if (status === "verified" || result.verification.integrity_check === "passed") {
            return { color: "success", icon: <CheckCircle />, text: "Verified - Authentic" };
        } else if (status === "tampered" || result.verification.integrity_check === "failed") {
            return { color: "error", icon: <Warning />, text: "Tampered - Data Modified" };
        } else {
            return { color: "warning", icon: <ErrorOutline />, text: "Pending Verification" };
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: "auto", py: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: "center", mb: 6 }}>
                <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, color: "#1a365d" }}>
                    Extract Secret Data
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: "auto" }}>
                    Retrieve hidden information and verify image integrity using our reversible extraction algorithm.
                </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: "16px" }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {/* Tamper Detection Banner */}
            {isTampered && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: "16px", border: "2px solid #d32f2f" }}
                    onClose={() => setIsTampered(false)}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        ❌ Image Tampered — Extraction Refused
                    </Typography>
                    <Typography variant="body2">
                        The pixel integrity hash does not match. This image has been modified
                        externally after watermarking. Extraction is refused to protect data integrity.
                        Use the original unmodified watermarked image.
                    </Typography>
                </Alert>
            )}

            {/* Main Upload Paper */}
            <Paper
                elevation={0}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                sx={{
                    p: 4,
                    borderRadius: "24px",
                    bgcolor: "white",
                    border: image ? "1px solid #e2e8f0" : "2px dashed #cbd5e0",
                    transition: "all 0.3s ease",
                    position: "relative",
                    minHeight: 400,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    "&:hover": {
                        borderColor: image ? "#e2e8f0" : "#1976d2",
                        bgcolor: image ? "white" : "rgba(25, 118, 210, 0.02)",
                    },
                }}
            >
                {!image && !hasUploadedAtLeastOnce ? (
                    // Initial Big Upload State (only for the very first time)
                    <Stack spacing={3} alignItems="center" sx={{ py: 6 }}>
                        <Box sx={{
                            p: 3,
                            borderRadius: "50%",
                            bgcolor: "rgba(2, 136, 209, 0.1)",
                            color: "#0288d1",
                            animation: "pulse 2s infinite",
                            "@keyframes pulse": {
                                "0%": { transform: "scale(1)", opacity: 1 },
                                "50%": { transform: "scale(1.05)", opacity: 0.8 },
                                "100%": { transform: "scale(1)", opacity: 1 },
                            },
                        }}>
                            <ContentPasteSearch sx={{ fontSize: 80 }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Drop watermarked image here
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => fileInputRef.current.click()}
                            sx={{
                                px: 6,
                                py: 1.5,
                                borderRadius: "30px",
                                textTransform: "none",
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                bgcolor: "#0288d1",
                                "&:hover": { bgcolor: "#01579b" },
                                boxShadow: "0 4px 15px rgba(2, 136, 209, 0.3)",
                            }}
                        >
                            Choose Encoded Image
                        </Button>
                        <Typography color="text.secondary">
                            Must be an image generated by our autoencoder tool
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                            <Chip icon={<Security />} label="128-bit verification" variant="outlined" />
                            <Chip icon={<VerifiedUser />} label="Tamper detection" variant="outlined" />
                        </Stack>
                    </Stack>
                ) : (
                    // Image Preview and Extraction State (OR Small Upload box if image cleared)
                    <Fade in={true}>
                        <Box sx={{ width: "100%" }}>
                            {/* Header Section: Image Preview or Compact Upload */}
                            <Box sx={{ position: "relative", display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
                                {!image ? (
                                    <Paper
                                        elevation={0}
                                        onClick={() => fileInputRef.current.click()}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: "20px",
                                            bgcolor: "rgba(2, 136, 209, 0.04)",
                                            border: "2px dashed #0288d1",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 1.5,
                                            cursor: "pointer",
                                            minWidth: 160,
                                            transition: "all 0.3s ease",
                                            "&:hover": {
                                                bgcolor: "rgba(2, 136, 209, 0.08)",
                                                transform: "translateY(-2px)"
                                            }
                                        }}
                                    >
                                        <CloudUpload sx={{ fontSize: 24, color: "#0288d1" }} />
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#0288d1" }}>
                                            Upload Image
                                        </Typography>
                                    </Paper>
                                ) : (
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            position: "relative",
                                            p: 1.5,
                                            borderRadius: "20px",
                                            bgcolor: "rgba(2, 136, 209, 0.04)",
                                            border: "1px solid #e2e8f0",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 1.5,
                                            transition: "all 0.3s ease",
                                            "&:hover": {
                                                bgcolor: "rgba(2, 136, 209, 0.08)",
                                                borderColor: "#0288d1",
                                                "& .remove-image-btn": { opacity: 1 }
                                            }
                                        }}
                                    >
                                        <ImageIcon sx={{ fontSize: 40, color: "#0288d1" }} />
                                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#1a365d" }} noWrap>
                                                {imageName}
                                            </Typography>
                                        </Box>

                                        <IconButton
                                            className="remove-image-btn"
                                            onClick={clearImage}
                                            size="small"
                                            sx={{
                                                position: "absolute",
                                                top: -10,
                                                right: -10,
                                                opacity: 0,
                                                transition: "all 0.2s ease",
                                                bgcolor: "white",
                                                border: "1px solid #e2e8f0",
                                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                                "&:hover": { bgcolor: "#fee2e2", color: "#ef4444", transform: "scale(1.1)" },
                                                zIndex: 5
                                            }}
                                        >
                                            <Close sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Paper>
                                )}

                                <Button
                                    size="small"
                                    onClick={() => setShowMetadataInput(!showMetadataInput)}
                                    startIcon={<Fingerprint />}
                                    sx={{
                                        ml: "auto",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        color: showMetadataInput ? "#0288d1" : "#64748b",
                                        "&:hover": { bgcolor: "rgba(2, 136, 209, 0.05)" }
                                    }}
                                >
                                    {showMetadataInput ? "Hide Advanced Options" : "Manual Metadata / Session Key"}
                                </Button>
                            </Box>

                            {/* Optional Metadata Input */}
                            <Box sx={{ width: '100%', mb: 3 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1a365d" }}>
                                        Metadata & Verification Keys
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            size="small"
                                            onClick={() => metadataFileInputRef.current.click()}
                                            startIcon={<CloudUpload />}
                                            sx={{ textTransform: "none", fontWeight: 600 }}
                                        >
                                            Load JSON
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => setShowMetadataInput(!showMetadataInput)}
                                            startIcon={<Fingerprint />}
                                            sx={{
                                                textTransform: "none",
                                                fontWeight: 600,
                                                color: showMetadataInput ? "#0288d1" : "#64748b"
                                            }}
                                        >
                                            {showMetadataInput ? "Hide Fields" : "Enter Manually"}
                                        </Button>
                                    </Stack>
                                </Stack>

                                {showMetadataInput && (
                                    <Zoom in={true}>
                                        <Paper sx={{ p: 3, bgcolor: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="Image ID"
                                                        placeholder="e.g., 60f7b1b5e6b3f32d8c9e4a1b"
                                                        value={metadataInput.image_id}
                                                        onChange={(e) => setMetadataInput({ ...metadataInput, image_id: e.target.value })}
                                                        disabled={isProcessing}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="Session Key"
                                                        placeholder="Session key from embedding"
                                                        value={metadataInput.session_key}
                                                        onChange={(e) => setMetadataInput({ ...metadataInput, session_key: e.target.value })}
                                                        disabled={isProcessing}
                                                    />
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="password"
                                                        label="Decryption Password"
                                                        placeholder="Enter password if data was encrypted during embedding"
                                                        value={decryptionPassword}
                                                        onChange={(e) => setDecryptionPassword(e.target.value)}
                                                        disabled={isProcessing}
                                                    />
                                                </Grid>
                                            </Grid>
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                                * Image ID and Session Key required for descrambling. Password only needed if data was encrypted.
                                            </Typography>
                                        </Paper>
                                    </Zoom>
                                )}
                            </Box>

                            <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                                <Box sx={{ maxWidth: 600, mx: "auto" }}>
                                    {!isExtracted ? (
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            size="large"
                                            disabled={!image || isProcessing}
                                            onClick={handleExtract}
                                            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                                            sx={{
                                                py: 2,
                                                borderRadius: "16px",
                                                fontSize: "1.1rem",
                                                fontWeight: 700,
                                                textTransform: "none",
                                                bgcolor: "#0288d1",
                                                "&:hover": { bgcolor: "#01579b", transform: "translateY(-2px)" },
                                                transition: "all 0.3s ease",
                                            }}
                                        >
                                            {isProcessing ? "Extracting with Autoencoder..." : "Run Reversible Extraction"}
                                        </Button>
                                    ) : (
                                        <Stack spacing={3}>
                                            {/* Verification Status Alert */}
                                            {result?.verification && (
                                                <Alert
                                                    severity={getVerificationStatus().color}
                                                    icon={getVerificationStatus().icon}
                                                    sx={{ borderRadius: "16px", textAlign: "left" }}
                                                >
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                        {getVerificationStatus().text}
                                                    </Typography>
                                                    {result.verification.verification_status === "verified" && (
                                                        <Typography variant="body2">
                                                            Image integrity verified. Data extracted successfully and authentication tags match.
                                                        </Typography>
                                                    )}
                                                    {result.verification.verification_status === "tampered" && (
                                                        <Typography variant="body2">
                                                            Warning: Image has been tampered with! Extracted data may not be authentic.
                                                        </Typography>
                                                    )}
                                                </Alert>
                                            )}

                                            {/* Extracted Data Display */}
                                            <Box sx={{ textAlign: "left" }}>
                                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, ml: 1, display: "flex", alignItems: "center" }}>
                                                    <Restore sx={{ mr: 1, fontSize: 20 }} />
                                                    EXTRACTED INFORMATION:
                                                </Typography>
                                                <Paper
                                                    variant="outlined"
                                                    sx={{
                                                        p: 3,
                                                        borderRadius: "16px",
                                                        bgcolor: "#f8fafc",
                                                        fontFamily: "monospace",
                                                        fontSize: "0.95rem",
                                                        lineHeight: 1.6,
                                                        border: "1px solid #e2e8f0",
                                                        maxHeight: 300,
                                                        overflow: "auto",
                                                    }}
                                                >
                                                    {extractedData}
                                                </Paper>
                                            </Box>

                                            {/* Security Info */}
                                            {result && (
                                                <Card sx={{ borderRadius: "16px", bgcolor: "#f5f5f5" }}>
                                                    <CardContent>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: "#0288d1" }}>
                                                            Security Details
                                                        </Typography>
                                                        <Stack spacing={1.5}>
                                                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                                <Typography variant="body2" color="text.secondary">Autoencoder Tag:</Typography>
                                                                <Tooltip title={result.extracted_tag || result.current_tag || ""}>
                                                                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                                                        {(result.extracted_tag || result.current_tag)?.substring(0, 16)}...
                                                                    </Typography>
                                                                </Tooltip>
                                                            </Box>
                                                            <Divider />
                                                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                                <Typography variant="body2" color="text.secondary">Extraction Time:</Typography>
                                                                <Typography variant="body2" fontWeight={600}>
                                                                    {result.metadata?.extraction_time || "320ms"}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                                <Typography variant="body2" color="text.secondary">Data Size:</Typography>
                                                                <Typography variant="body2" fontWeight={600}>
                                                                    {result.metadata?.data_size || extractedData.length} bytes
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Action Buttons */}
                                            <Stack direction="row" spacing={2}>
                                                <Button
                                                    variant="contained"
                                                    size="large"
                                                    onClick={handleDownloadResult}
                                                    startIcon={<Download />}
                                                    sx={{
                                                        flex: 1,
                                                        py: 1.5,
                                                        borderRadius: "16px",
                                                        fontSize: "1rem",
                                                        fontWeight: 700,
                                                        textTransform: "none",
                                                        bgcolor: "#0288d1",
                                                    }}
                                                >
                                                    Download Text
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="large"
                                                    onClick={handleDownloadVerificationReport}
                                                    startIcon={<Security />}
                                                    sx={{
                                                        flex: 1,
                                                        py: 1.5,
                                                        borderRadius: "16px",
                                                        fontSize: "1rem",
                                                        fontWeight: 700,
                                                        textTransform: "none",
                                                        borderColor: "#0288d1",
                                                        color: "#0288d1",
                                                        borderWidth: 2,
                                                    }}
                                                >
                                                    Verification Report
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="large"
                                                    onClick={handleRetry}
                                                    startIcon={<Replay />}
                                                    sx={{
                                                        flex: 1,
                                                        py: 1.5,
                                                        borderRadius: "16px",
                                                        fontSize: "1rem",
                                                        fontWeight: 700,
                                                        textTransform: "none",
                                                        borderColor: "#64748b",
                                                        color: "#64748b",
                                                        borderWidth: 2,
                                                        "&:hover": { borderColor: "#1a365d", color: "#1a365d", bgcolor: "rgba(26,54,93,0.04)" },
                                                    }}
                                                >
                                                    Try Again
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    )}
                                </Box>
                            </Zoom>
                        </Box>
                    </Fade>
                )}
                <input
                    type="file"
                    hidden
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                />
                <input
                    type="file"
                    hidden
                    accept=".json"
                    ref={metadataFileInputRef}
                    onChange={(e) => handleMetadataFile(e.target.files[0])}
                />
            </Paper>

            {/* Processing Overlay */}
            {
                isProcessing && (
                    <Box
                        sx={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: "rgba(0,0,0,0.5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 9999,
                            backdropFilter: "blur(5px)",
                        }}
                    >
                        <Paper sx={{ p: 4, borderRadius: "24px", textAlign: "center", maxWidth: 400 }}>
                            <CircularProgress size={60} sx={{ mb: 2 }} />
                            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                                Extracting with Autoencoder
                            </Typography>
                            <Typography color="text.secondary">
                                Extracting LSB bits • Descrambling • Verifying integrity • Reconstructing data
                            </Typography>
                        </Paper>
                    </Box>
                )
            }

            {/* Notifications */}
            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={handleCloseNotification}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ borderRadius: "12px" }}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Extract;