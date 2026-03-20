import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Stack,
  Divider,
  Avatar,
  Tooltip,
  Alert,
  AlertTitle,
} from "@mui/material";
import {
  CloudUpload,
  Delete,
  Visibility,
  Download,
  Share,
  CheckCircle,
  Error,
  Image,
  Settings,
  Lock,
  VerifiedUser,
  InsertDriveFile,
  PhotoCamera,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

// Styled components
const UploadArea = styled(Paper)(({ theme, isDragActive }) => ({
  border: `3px dashed ${isDragActive ? theme.palette.secondary.main : "rgba(0, 212, 255, 0.2)"}`,
  borderRadius: 16,
  padding: theme.spacing(6, 4),
  textAlign: "center",
  backgroundColor: isDragActive ? theme.palette.primary.light + '10' : theme.palette.background.paper,
  cursor: "pointer",
  transition: "all 0.3s ease",
  minHeight: 300,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
  overflow: "hidden",
  "&:hover": {
    borderColor: theme.palette.primary.main,
    backgroundColor: "rgba(0, 212, 255, 0.05)",
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[4],
  },
}));

const ImagePreview = styled(Box)(({ theme }) => ({
  width: "100%",
  height: 200,
  borderRadius: 12,
  overflow: "hidden",
  position: "relative",
  "& img": {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transition: "transform 0.3s ease",
  },
  "&:hover img": {
    transform: "scale(1.05)",
  },
}));

const MetricCard = styled(Card)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `1px solid rgba(0, 212, 255, 0.1)`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
  height: "100%",
  transition: "all 0.3s ease",
  "&:hover": {
    borderColor: theme.palette.primary.light,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
  },
}));

function AutoencoderCard() {
  const [image, setImage] = useState(null);
  const [encodedImage, setEncodedImage] = useState(null);
  const [decodedImage, setDecodedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const sampleFiles = [
    { name: "chest_xray.dcm", size: "4.2 MB", type: "DICOM", uploaded: "2 min ago" },
    { name: "brain_mri.nii", size: "12.5 MB", type: "NIFTI", uploaded: "5 min ago" },
    { name: "ultrasound.jpg", size: "2.1 MB", type: "JPEG", uploaded: "10 min ago" },
  ];

  const handleImage = (file) => {
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const newFile = {
        id: Date.now(),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
        type: file.type,
        uploaded: "Just now",
        url: imageUrl,
      };
      setImage(imageUrl);
      setUploadedFiles(prev => [newFile, ...prev]);
      setEncodedImage(null);
      setDecodedImage(null);
      setMetrics(null);

      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setUploadProgress(progress);
      }, 100);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImage(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const openFilePicker = () => {
    fileInputRef.current.click();
  };

  const simulateEncoding = () => {
    if (!image) return;

    setProcessing(true);
    setUploadProgress(0);

    // Simulate encoding progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setEncodedImage(image);
          setMetrics({
            psnr: "45.2 dB",
            ssim: "0.992",
            embeddingRate: "0.5 bpp",
            processingTime: "320ms",
            fileSize: "4.3 MB",
            securityLevel: "High",
          });
          setProcessing(false);
        }, 500);
      }
      setUploadProgress(progress);
    }, 200);
  };

  const simulateDecoding = () => {
    if (!encodedImage) return;

    setProcessing(true);
    setUploadProgress(0);

    // Simulate decoding progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setDecodedImage(image);
          setProcessing(false);
        }, 300);
      }
      setUploadProgress(progress);
    }, 150);
  };

  const removeImage = () => {
    setImage(null);
    setEncodedImage(null);
    setDecodedImage(null);
    setMetrics(null);
    setUploadProgress(0);
  };

  const shareImage = () => {
    navigator.clipboard.writeText("https://autoencoder-portal.com/share/" + Date.now());
    alert("Share link copied to clipboard!");
  };

  const watermarkSuggestions = [
    "Patient_ID: P-2024-001",
    "Study Date: 2024-01-15",
    "Institution: Medical Research Center",
    "Physician: Dr. Smith",
    "Confidential - Medical Data",
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 800, color: "#e6f1ff" }}>
          Medical Image Encoding Studio
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 800, mx: "auto", mb: 3 }}>
          Securely embed patient data and verify authenticity with our autoencoder-based watermarking system
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Left Column - Upload & Preview */}
        <Grid item xs={12} md={8}>
          {/* Upload Area */}
          <UploadArea
            elevation={0}
            isDragActive={isDragActive}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={openFilePicker}
          >
            <input
              type="file"
              accept="image/*,.dcm,.nii,.nii.gz"
              ref={fileInputRef}
              onChange={(e) => handleImage(e.target.files[0])}
              style={{ display: "none" }}
            />

            {!image ? (
              <>
                <Box sx={{ fontSize: 64, color: "primary.main", mb: 3 }}>
                  <CloudUpload fontSize="inherit" />
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                  Drag & drop medical images here
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3 }}>
                  or click to browse. Supports DICOM, JPEG, PNG, NIFTI (Max 50MB)
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PhotoCamera />}
                  sx={{
                    background: "linear-gradient(135deg, #00d4ff, #0094b2)",
                    color: "#020c1b",
                    px: 4,
                    py: 1.5,
                  }}
                >
                  Choose Image
                </Button>
                <Stack direction="row" spacing={2} sx={{ mt: 4, flexWrap: "wrap", justifyContent: "center" }}>
                  <Chip icon={<InsertDriveFile />} label="DICOM" variant="outlined" />
                  <Chip icon={<Image />} label="JPEG/PNG" variant="outlined" />
                  <Chip icon={<InsertDriveFile />} label="NIFTI" variant="outlined" />
                  <Chip icon={<Lock />} label="Secure" variant="outlined" />
                </Stack>
              </>
            ) : (
              <Box sx={{ width: "100%" }}>
                <ImagePreview>
                  <img src={image} alt="Preview" />
                  <Box sx={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    display: "flex",
                    gap: 1,
                  }}>
                    <Tooltip title="Remove">
                      <IconButton onClick={removeImage} sx={{ bgcolor: "white", "&:hover": { bgcolor: "grey.100" } }}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View">
                      <IconButton sx={{ bgcolor: "white", "&:hover": { bgcolor: "grey.100" } }}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ImagePreview>

                {/* Upload Progress */}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Uploading... {Math.round(uploadProgress)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}
              </Box>
            )}
          </UploadArea>

          {/* Processing Progress */}
          {processing && (
            <Paper sx={{ p: 3, mt: 3, border: "1px solid", borderColor: "secondary.main", bgcolor: "rgba(0, 212, 255, 0.05)" }}>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Settings /> Processing Image...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{ height: 10, borderRadius: 5, mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary" align="right">
                {uploadProgress < 50 ? "Encoding watermark..." :
                  uploadProgress < 80 ? "Optimizing quality..." :
                    "Finalizing..."}
              </Typography>
            </Paper>
          )}

          {/* Watermark Input */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <VerifiedUser /> Watermark Information
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="Enter patient information, metadata, or signature..."
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Quick suggestions:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {watermarkSuggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  label={suggestion}
                  size="small"
                  clickable
                  onClick={() => setWatermarkText(suggestion)}
                  variant="outlined"
                />
              ))}
            </Stack>
          </Paper>

          {/* Action Buttons */}
          <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={simulateEncoding}
                disabled={!image || processing}
                startIcon={processing ? <Settings /> : <Lock />}
                sx={{
                  py: 1.5,
                  background: "linear-gradient(135deg, #00d4ff, #0094b2)",
                  color: "#020c1b",
                  "&:hover": {
                    background: "linear-gradient(135deg, #33ddff, #00d4ff)",
                  },
                }}
              >
                {processing ? "Encoding..." : "🔐 Encode & Watermark"}
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={simulateDecoding}
                disabled={!encodedImage || processing}
                startIcon={<VerifiedUser />}
                sx={{
                  py: 1.5,
                  borderWidth: 2,
                  borderColor: "secondary.main",
                  color: "secondary.main",
                }}
              >
                🔍 Decode & Verify
              </Button>
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column - Stats & Recent Files */}
        <Grid item xs={12} md={4}>
          {/* Performance Metrics */}
          {metrics ? (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircle color="success" /> Encoding Complete
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(metrics).map(([key, value]) => (
                  <Grid item xs={6} key={key}>
                    <MetricCard>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "secondary.main" }}>
                        {value}
                      </Typography>
                    </MetricCard>
                  </Grid>
                ))}
              </Grid>

              {/* Share Actions */}
              <Paper sx={{ p: 2, mt: 3, bgcolor: "rgba(0, 212, 255, 0.05)", border: "1px solid rgba(0, 212, 255, 0.1)" }}>
                <Typography variant="subtitle2" gutterBottom>
                  Share & Export
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Download />}
                    sx={{ flex: 1 }}
                  >
                    Download
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Share />}
                    onClick={shareImage}
                    sx={{ flex: 1 }}
                  >
                    Share
                  </Button>
                </Stack>
              </Paper>
            </Box>
          ) : (
            <Paper sx={{ p: 3, mb: 4, bgcolor: "#112d4e", border: "1px solid rgba(0, 212, 255, 0.1)" }}>
              <Typography variant="h6" gutterBottom>
                📊 Performance Metrics
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Upload and encode an image to see detailed performance metrics including PSNR, SSIM, and processing time.
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>Tip</AlertTitle>
                Try our sample medical images to test the system
              </Alert>
            </Paper>
          )}

          {/* Recent Files */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <InsertDriveFile /> Recent Files
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Sample Files */}
            {sampleFiles.map((file, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 1.5,
                  mb: 1,
                  borderRadius: 2,
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <Avatar sx={{ bgcolor: "secondary.light", color: "#020c1b", mr: 2 }}>
                  <InsertDriveFile />
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {file.size} • {file.type} • {file.uploaded}
                  </Typography>
                </Box>
                <IconButton size="small">
                  <Download fontSize="small" />
                </IconButton>
              </Box>
            ))}

            {/* User Uploaded Files */}
            {uploadedFiles.map((file) => (
              <Box
                key={file.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 1.5,
                  mb: 1,
                  borderRadius: 2,
                  bgcolor: "rgba(0, 212, 255, 0.05)",
                  border: "1px solid",
                  borderColor: "secondary.main",
                }}
              >
                <Avatar sx={{ bgcolor: "secondary.main", color: "#020c1b", mr: 2 }}>
                  <Image />
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {file.size} • {file.type} • {file.uploaded}
                  </Typography>
                </Box>
                <IconButton size="small" color="primary">
                  <Visibility fontSize="small" />
                </IconButton>
              </Box>
            ))}

            {uploadedFiles.length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                No recent uploads
              </Typography>
            )}
          </Paper>

          {/* Quick Stats */}
          <Paper sx={{ p: 3, mt: 3, bgcolor: "rgba(0, 212, 255, 0.05)", border: "1px solid", borderColor: "secondary.main" }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              ⚡ Quick Stats
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Images Processed</Typography>
                <Typography variant="h6">1,247</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Success Rate</Typography>
                <Typography variant="h6">99.8%</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Avg. Time</Typography>
                <Typography variant="h6">420ms</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Security</Typography>
                <Typography variant="h6">High</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Results Display */}
      {decodedImage && (
        <Paper sx={{ p: 4, mt: 4, border: "2px solid", borderColor: "success.main", bgcolor: "rgba(46, 125, 50, 0.05)" }}>
          <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1, color: "success.dark" }}>
            <CheckCircle /> ✓ Decoding Successful
          </Typography>
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle>Image Integrity Verified</AlertTitle>
            Patient data extracted successfully with 100% accuracy. Original image restored pixel-perfectly.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 2, height: "100%" }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Extracted Watermark
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: "monospace", bgcolor: "#112d4e", p: 2, borderRadius: 1 }}>
                  {watermarkText || "Patient_ID: 12345 | Date: 2024-01-15"}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ p: 2, height: "100%" }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Verification Results
                </Typography>
                <Box sx={{ "& > *": { mb: 0.5 } }}>
                  <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircle fontSize="small" color="success" /> Integrity: Verified
                  </Typography>
                  <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircle fontSize="small" color="success" /> Authenticity: Confirmed
                  </Typography>
                  <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircle fontSize="small" color="success" /> Pixel Accuracy: 100%
                  </Typography>
                  <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircle fontSize="small" color="success" /> Tamper Detection: None
                  </Typography>
                </Box>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Restored Image
                </Typography>
                <ImagePreview sx={{ height: 150 }}>
                  <img src={decodedImage} alt="Restored" />
                </ImagePreview>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Download />}
                  sx={{ mt: 2 }}
                >
                  Download Original
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
}

export default AutoencoderCard;