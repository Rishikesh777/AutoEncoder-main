import { Button, Container, Grid, Paper, Typography, Box, Card, Stack, Avatar } from "@mui/material";
import {
  Security,
  Speed,
  Verified,
  CloudUpload,
  Lock,
  ArrowForward,
  InfoOutlined,
  ImageOutlined,
  Autorenew,
} from "@mui/icons-material";

function Home({ setActivePage }) {
  const steps = [
    {
      icon: <CloudUpload sx={{ fontSize: 40 }} />,
      title: "Upload image and secret data",
      desc: "Select your cover image and the sensitive info you want to hide."
    },
    {
      icon: <Lock sx={{ fontSize: 40 }} />,
      title: "Process securely",
      desc: "Our autoencoder embeds the data with minimal visual impact."
    },
    {
      icon: <ArrowForward sx={{ fontSize: 40 }} />,
      title: "Download result",
      desc: "Retrieve your watermarked image with hidden data."
    }
  ];

  const features = [
    {
      icon: <Security fontSize="large" />,
      title: "Secure data hiding",
      description: "Advanced encryption and deep learning for maximum security.",
    },
    {
      icon: <Autorenew fontSize="large" />,
      title: "Reversible extraction",
      description: "Extract hidden data and restore original image perfectly.",
    },
    {
      icon: <Speed fontSize="large" />,
      title: "Fast processing",
      description: "Optimized neural network for sub-second processing.",
    },
    {
      icon: <InfoOutlined fontSize="large" />,
      title: "User-friendly interface",
      description: "Simple workflow designed for researchers and professionals.",
    },
    {
      icon: <ImageOutlined fontSize="large" />,
      title: "PNG and JPG support",
      description: "Broad compatibility with standard image formats.",
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)",
          color: "white",
          pt: { xs: 12, md: 20 },
          pb: { xs: 12, md: 20 },
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Container maxWidth="lg">
          <Grid container alignItems="center" spacing={4}>
            <Grid item xs={12} md={7} sx={{ textAlign: { xs: "center", md: "left" } }}>
              <Typography
                variant="h1"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "2.5rem", md: "4rem" },
                  mb: 2,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                Secure Reversible <br />
                <span style={{ color: "#ffeb3b" }}>Data Hiding Tool</span>
              </Typography>
              <Typography variant="h5" sx={{ mb: 5, opacity: 0.9, fontWeight: 400, maxWidth: "600px" }}>
                Hide sensitive information inside images and retrieve it securely with
                our advanced deep learning autoencoder.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent={{ xs: "center", md: "flex-start" }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setActivePage("embed")}
                  sx={{
                    bgcolor: "white",
                    color: "#1976d2",
                    px: 6,
                    py: 2,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    borderRadius: "12px",
                    "&:hover": { bgcolor: "#f5f5f5", transform: "translateY(-2px)" },
                    transition: "all 0.3s ease",
                  }}
                >
                  Embed Data
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => setActivePage("extract")}
                  sx={{
                    borderColor: "rgba(255,255,255,0.5)",
                    color: "white",
                    px: 6,
                    py: 2,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    borderRadius: "12px",
                    borderWidth: 2,
                    "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)", transform: "translateY(-2px)" },
                    transition: "all 0.3s ease",
                  }}
                >
                  Extract Data
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How It Works */}
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Typography variant="h2" align="center" sx={{ mb: 8, fontWeight: 800 }}>
          How It Works
        </Typography>
        <Grid container spacing={4}>
          {steps.map((step, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Box
                sx={{
                  p: 4,
                  height: "100%",
                  textAlign: "center",
                  borderRadius: "24px",
                  background: "white",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
                  border: "1px solid #f0f0f0",
                  transition: "transform 0.3s ease",
                  "&:hover": { transform: "translateY(-10px)" },
                }}
              >
                <Avatar
                  sx={{
                    width: 100,
                    height: 100,
                    margin: "0 auto 24px",
                    bgcolor: "rgba(25, 118, 210, 0.1)",
                    color: "#1976d2",
                  }}
                >
                  {step.icon}
                </Avatar>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
                  {step.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {step.desc}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features section */}
      <Box sx={{ bgcolor: "#f5f9ff", py: 12 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" align="center" sx={{ mb: 8, fontWeight: 800 }}>
            Core Features
          </Typography>
          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    p: 4,
                    height: "100%",
                    borderRadius: "20px",
                    border: "1px solid rgba(0,0,0,0.05)",
                    transition: "all 0.3s",
                    "&:hover": { boxShadow: "0 20px 50px rgba(0,0,0,0.1)" },
                  }}
                >
                  <Box sx={{ color: "#1976d2", mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>


    </Box>
  );
}

export default Home;