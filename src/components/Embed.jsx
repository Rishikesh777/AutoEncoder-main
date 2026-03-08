import React, { useState, useRef } from "react";
import {
    Box,
    Typography,
    Paper,
    Button,
    TextField,
    IconButton,
    Stack,
    Fade,
    Zoom,
    CircularProgress,
    Alert,
    Snackbar,
    Chip,
    Divider,
    Card,
    CardContent,
    Grid,
} from "@mui/material";
import {
    CloudUpload,
    Description,
    LockOutlined,
    DeleteOutline,
    AddPhotoAlternate,
    AutoFixHigh,
    Download,
    Security,
    VerifiedUser,
    CheckCircle,
} from "@mui/icons-material";
import { addHistory } from "../utils/history";

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem("auth_token");

const Embed = () => {
    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [dataToHide, setDataToHide] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const [imageName, setImageName] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: "", severity: "info" });

    // FIX: Store the watermarked image base64 in component state (not localStorage)
    // so the user can download it directly without bloating localStorage.
    const [watermarkedImageBase64, setWatermarkedImageBase64] = useState(null);

    const fileInputRef = useRef(null);
    const secretFileInputRef = useRef(null);

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(URL.createObjectURL(file));
            setImageFile(file);
            setImageName(file.name);
            setIsGenerated(false);
            setResult(null);
            setError(null);
            setWatermarkedImageBase64(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            setImage(URL.createObjectURL(file));
            setImageFile(file);
            setImageName(file.name);
            setIsGenerated(false);
            setResult(null);
            setError(null);
            setWatermarkedImageBase64(null);
        }
    };

    const handleSecretFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            setDataToHide(e.target.result);
            setIsGenerated(false);
            setResult(null);
            setError(null);
        };
        reader.readAsText(file);
    };

    const handleSecretDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        handleSecretFile(file);
    };

    const showNotification = (message, severity = "info") => {
        setNotification({ open: true, message, severity });
    };

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };

    const handleEmbed = async () => {
        if (!imageFile) {
            setError("Please select an image first");
            return;
        }
        if (!dataToHide.trim()) {
            setError("Please enter data to hide");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error("You must be logged in to use this feature");
            }

            const formData = new FormData();
            formData.append("image", imageFile);
            formData.append("data", dataToHide);

            showNotification("Uploading image to autoencoder...", "info");

            // All calls go through the Node.js proxy at /api — no direct Python URL needed.
            const response = await fetch("/api/autoencoder/embed", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || "Embedding failed");
            }

            setResult(data);
            setIsGenerated(true);

            // FIX: Store base64 in component state, NOT in history/localStorage
            if (data.image) {
                setWatermarkedImageBase64(data.image);
            }

            // FIX: Do NOT pass resultImage to addHistory — it strips it internally
            // but being explicit here is cleaner and avoids confusion.
            addHistory({
                type: "Embed",
                imageName: imageName,
                data: dataToHide,
                status: "Success",
                metadata: {
                    image_id: data.image_id,
                    auth_tag: data.auth_tag,
                    autoencoder_tag: data.autoencoder_tag,
                    embedding_rate: data.metadata?.embedding_rate,
                }
            });

            showNotification("✓ Data embedded successfully!", "success");

        } catch (err) {
            console.error("Embedding error:", err);
            setError(err.message);
            showNotification(`Error: ${err.message}`, "error");

            addHistory({
                type: "Embed",
                imageName: imageName,
                data: dataToHide,
                status: "Error",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (watermarkedImageBase64) {
            const link = document.createElement("a");
            link.href = `data:image/png;base64,${watermarkedImageBase64}`;
            link.download = `watermarked_${imageName || "image.png"}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadMetadata = () => {
        if (!result) return;

        const metadata = {
            image_id: result.image_id,
            auth_tag: result.auth_tag,
            autoencoder_tag: result.autoencoder_tag,
            session_key: result.session_key,
            metadata: result.metadata,
            timestamp: new Date().toISOString(),
            image_name: imageName,
        };

        const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `metadata_${imageName || "image"}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearImage = () => {
        setImage(null);
        setImageFile(null);
        setDataToHide("");
        setIsGenerated(false);
        setResult(null);
        setError(null);
        setWatermarkedImageBase64(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: "auto", py: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: "center", mb: 6 }}>
                <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, color: "#1a365d" }}>
                    Embed Secret Data
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: "auto" }}>
                    Hide information inside your images with pixel-perfect precision
                    using our secure autoencoder technology.
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
                {!image ? (
                    <Stack spacing={3} alignItems="center" sx={{ py: 6 }}>
                        <Box sx={{
                            p: 3,
                            borderRadius: "50%",
                            bgcolor: "rgba(25, 118, 210, 0.1)",
                            color: "#1976d2",
                            animation: "pulse 2s infinite",
                            "@keyframes pulse": {
                                "0%": { transform: "scale(1)", opacity: 1 },
                                "50%": { transform: "scale(1.05)", opacity: 0.8 },
                                "100%": { transform: "scale(1)", opacity: 1 },
                            },
                        }}>
                            <AddPhotoAlternate sx={{ fontSize: 80 }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Drop your medical image here
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
                                boxShadow: "0 4px 15px rgba(25, 118, 210, 0.3)",
                            }}
                        >
                            Choose Medical Image
                        </Button>
                        <Typography color="text.secondary">
                            Supports DICOM, PNG, JPG (Max 50MB)
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                            <Chip icon={<Security />} label="128-bit encryption" variant="outlined" />
                            <Chip icon={<VerifiedUser />} label="Lossless" variant="outlined" />
                        </Stack>
                    </Stack>
                ) : (
                    <Fade in={true}>
                        <Box sx={{ width: "100%" }}>
                            <Box sx={{ position: "relative", display: "inline-block", mb: 4 }}>
                                <Box
                                    component="img"
                                    src={image}
                                    sx={{
                                        maxWidth: "100%",
                                        maxHeight: 400,
                                        borderRadius: "16px",
                                        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                                    }}
                                />
                                <IconButton
                                    onClick={clearImage}
                                    disabled={isProcessing}
                                    sx={{
                                        position: "absolute",
                                        top: -15,
                                        right: -15,
                                        bgcolor: "white",
                                        border: "1px solid #e2e8f0",
                                        "&:hover": { bgcolor: "#fee2e2", color: "#ef4444" },
                                        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    <DeleteOutline />
                                </IconButton>

                                <Chip
                                    label={imageName}
                                    size="small"
                                    sx={{
                                        position: "absolute",
                                        bottom: -10,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        bgcolor: "primary.main",
                                        color: "white",
                                        fontWeight: 600,
                                    }}
                                />
                            </Box>

                            <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                                <Box sx={{ maxWidth: 600, mx: "auto", textAlign: "left" }}>
                                    <Box
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={handleSecretDrop}
                                        sx={{
                                            position: "relative",
                                            mb: 3,
                                            p: 0.5,
                                            borderRadius: "20px",
                                            border: "2px dashed transparent",
                                            transition: "all 0.2s",
                                            "&:hover": {
                                                borderColor: "rgba(25, 118, 210, 0.3)",
                                                bgcolor: "rgba(25, 118, 210, 0.01)"
                                            }
                                        }}
                                    >
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center" }}>
                                                <Description sx={{ mr: 1, color: "#1976d2" }} />
                                                Patient Information / Secret Data
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<CloudUpload />}
                                                onClick={() => secretFileInputRef.current.click()}
                                                sx={{ borderRadius: "20px", textTransform: "none" }}
                                                disabled={isProcessing}
                                            >
                                                Upload File
                                            </Button>
                                        </Stack>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            placeholder="Type patient information, medical notes, or any secret data here..."
                                            variant="outlined"
                                            value={dataToHide}
                                            onChange={(e) => { setDataToHide(e.target.value); setIsGenerated(false); }}
                                            disabled={isProcessing}
                                            sx={{
                                                "& .MuiOutlinedInput-root": {
                                                    borderRadius: "16px",
                                                    bgcolor: "#f8fafc",
                                                },
                                            }}
                                        />
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                            Data will be compressed and encrypted before embedding
                                        </Typography>
                                        <input
                                            type="file"
                                            hidden
                                            ref={secretFileInputRef}
                                            onChange={(e) => handleSecretFile(e.target.files[0])}
                                            accept=".txt,.md,.json,.csv,text/*"
                                        />
                                    </Box>

                                    <Stack spacing={2}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            size="large"
                                            disabled={!dataToHide.trim() || isProcessing}
                                            onClick={handleEmbed}
                                            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <AutoFixHigh />}
                                            sx={{
                                                py: 2,
                                                borderRadius: "16px",
                                                fontSize: "1.1rem",
                                                fontWeight: 700,
                                                textTransform: "none",
                                                background: "linear-gradient(135deg, #1976d2, #1565c0)",
                                                "&:hover": {
                                                    background: "linear-gradient(135deg, #1565c0, #0d47a1)",
                                                    transform: "translateY(-2px)",
                                                },
                                                transition: "all 0.3s ease",
                                            }}
                                        >
                                            {isProcessing ? "Processing with Autoencoder..." : "Generate Secure Watermarked Image"}
                                        </Button>
                                    </Stack>
                                </Box>
                            </Zoom>
                        </Box>
                    </Fade>
                )}
                <input
                    type="file"
                    hidden
                    accept="image/*,.dcm"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                />
            </Paper>

            {/* Results Section */}
            {isGenerated && result && (
                <Fade in={true}>
                    <Paper sx={{ mt: 4, p: 4, borderRadius: "24px", bgcolor: "#f8fafc" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                            <CheckCircle sx={{ color: "#2e7d32", fontSize: 32 }} />
                            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1a365d" }}>
                                Watermarked Image Generated Successfully
                            </Typography>
                        </Box>

                        <Grid container spacing={4}>
                            {/* Left Column - Image Preview */}
                            <Grid item xs={12} md={6}>
                                <Card sx={{ borderRadius: "20px", overflow: "hidden" }}>
                                    <Box sx={{ p: 2, bgcolor: "#1976d2", color: "white" }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Watermarked Image
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 2, textAlign: "center" }}>
                                        {watermarkedImageBase64 && (
                                            <Box
                                                component="img"
                                                src={`data:image/png;base64,${watermarkedImageBase64}`}
                                                sx={{
                                                    maxWidth: "100%",
                                                    maxHeight: 300,
                                                    borderRadius: "12px",
                                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                                }}
                                            />
                                        )}
                                        <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: "center" }}>
                                            <Button
                                                variant="contained"
                                                startIcon={<Download />}
                                                onClick={handleDownload}
                                                size="small"
                                                disabled={!watermarkedImageBase64}
                                            >
                                                Download Image
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<Description />}
                                                onClick={handleDownloadMetadata}
                                                size="small"
                                            >
                                                Metadata
                                            </Button>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                                            ⚠️ Download the metadata JSON — you'll need it for extraction.
                                        </Typography>
                                    </Box>
                                </Card>
                            </Grid>

                            {/* Right Column - Security Info */}
                            <Grid item xs={12} md={6}>
                                <Card sx={{ borderRadius: "20px", height: "100%" }}>
                                    <Box sx={{ p: 2, bgcolor: "#2e7d32", color: "white", borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Security & Performance
                                        </Typography>
                                    </Box>
                                    <CardContent>
                                        <Stack spacing={2}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <Typography color="text.secondary">Image ID:</Typography>
                                                <Chip
                                                    label={result.image_id?.substring(0, 16) + "..."}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </Box>
                                            <Divider />

                                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                <Typography color="text.secondary">Autoencoder Tag:</Typography>
                                                <Typography fontWeight={600} fontFamily="monospace">
                                                    {result.autoencoder_tag?.substring(0, 16)}...
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                                <Typography color="text.secondary">Auth Tag:</Typography>
                                                <Typography fontWeight={600} fontFamily="monospace">
                                                    {result.auth_tag?.substring(0, 16)}...
                                                </Typography>
                                            </Box>

                                            <Divider />

                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1a365d" }}>
                                                Performance Metrics
                                            </Typography>

                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Paper sx={{ p: 1.5, textAlign: "center", bgcolor: "#e3f2fd" }}>
                                                        <Typography variant="caption" color="text.secondary">Total Bits</Typography>
                                                        <Typography variant="h6">{result.metadata?.total_bits ?? "—"}</Typography>
                                                    </Paper>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Paper sx={{ p: 1.5, textAlign: "center", bgcolor: "#e8f5e8" }}>
                                                        <Typography variant="caption" color="text.secondary">Embed Rate</Typography>
                                                        <Typography variant="h6">{result.metadata?.embedding_rate ?? "—"}</Typography>
                                                    </Paper>
                                                </Grid>
                                            </Grid>

                                            <Alert severity="success" icon={<VerifiedUser />} sx={{ borderRadius: "12px" }}>
                                                <Typography variant="body2">
                                                    <strong>Multi-level verification enabled:</strong> Blake3 hash, 128-bit autoencoder tag, and lossless IWT embedding
                                                </Typography>
                                            </Alert>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Paper>
                </Fade>
            )}

            {/* Processing Overlay */}
            {isProcessing && (
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
                            Processing with Autoencoder
                        </Typography>
                        <Typography color="text.secondary">
                            Generating 128-bit tag • Compressing data • Embedding watermark • Applying PRNG scrambler
                        </Typography>
                    </Paper>
                </Box>
            )}

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

export default Embed;
