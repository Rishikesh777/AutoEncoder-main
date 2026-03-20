import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import AutoencoderCard from "./components/AutoencoderCard";
import ModelInfo from "./components/ModelInfo";
import ResultsDisplay from "./components/ResultsDisplay";
import MedicalApplication from "./components/MedicalApplication";
import Login from "./components/Login";
import Register from "./components/Register";
import Embed from "./components/Embed";
import Extract from "./components/Extract";
import History from "./components/History";
import Home from "./components/Home";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Security,
  MedicalServices,
  Speed,
  Verified,
  Analytics,
  CloudUpload,
} from "@mui/icons-material";
import "./App.css";

// Create dark theme
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#0a192f",
      light: "#112d4e",
      dark: "#08121f",
    },
    secondary: {
      main: "#00d4ff",
      light: "#33ddff",
      dark: "#0094b2",
    },
    accent: {
      main: "#ffd60a",
    },
    background: {
      default: "#08121f",
      paper: "rgba(255, 255, 255, 0.04)",
    },
    text: {
      primary: "#e6f1ff",
      secondary: "#8892b0",
    },
    divider: "rgba(0, 212, 255, 0.08)",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 800,
      fontSize: "3.5rem",
      color: "#e6f1ff",
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontWeight: 700,
      fontSize: "2.5rem",
      color: "#e6f1ff",
      marginBottom: "1rem",
    },
    h3: {
      fontWeight: 600,
      fontSize: "2rem",
      color: "#e6f1ff",
      marginBottom: "0.75rem",
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.5rem",
      color: "#e6f1ff",
      marginBottom: "0.5rem",
    },
    body1: {
      fontSize: "1.1rem",
      lineHeight: 1.7,
      color: "#8892b0",
    },
    body2: {
      fontSize: "1rem",
      lineHeight: 1.6,
      color: "#8892b0",
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          backgroundImage: "none",
          boxShadow: "0 0 15px rgba(0, 212, 255, 0.05)",
          border: "1px solid rgba(0, 212, 255, 0.15)",
          transition: "all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)",
          "&:hover": {
            transform: "translateY(-5px)",
            boxShadow: "0 8px 25px rgba(0, 212, 255, 0.1)",
            borderColor: "rgba(0, 212, 255, 0.4)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          backgroundImage: "none",
          border: "1px solid rgba(0, 212, 255, 0.12)",
          boxShadow: "0 10px 30px -15px rgba(2, 12, 27, 0.5)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none",
          borderRadius: 8,
          padding: "12px 28px",
          transition: "all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1)",
        },
        containedPrimary: {
          backgroundColor: "#00d4ff",
          color: "#020c1b",
          "&:hover": {
            backgroundColor: "#33ddff",
            boxShadow: "0 8px 16px rgba(0, 212, 255, 0.2)",
          },
        },
        outlinedPrimary: {
          borderColor: "#00d4ff",
          color: "#00d4ff",
          "&:hover": {
            backgroundColor: "rgba(0, 212, 255, 0.1)",
            borderColor: "#00d4ff",
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: "#e6f1ff",
        },
      },
    },
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activePage, setActivePage] = useState("login");
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const showNotification = (message, severity = "info") => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = (event, reason) => {
    if (reason === "clickaway") return;
    setNotification((prev) => ({ ...prev, open: false }));
  };

  // Check login status on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      setIsLoggedIn(true);
      setActivePage("home");
    }
  }, []);

  const renderContent = () => {
    // If not logged in, only allow login and register pages
    if (!isLoggedIn) {
      if (activePage === "register") {
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Register setActivePage={setActivePage} setIsLoggedIn={setIsLoggedIn} showNotification={showNotification} />
          </Box>
        );
      }
      return (
        <Box sx={{ pt: 12, pb: 8 }}>
          <Login setActivePage={setActivePage} setIsLoggedIn={setIsLoggedIn} showNotification={showNotification} />
        </Box>
      );
    }

    switch (activePage) {
      case "home":
        return <Home setActivePage={setActivePage} />;
      case "embed":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <Embed />
            </Container>
          </Box>
        );
      case "extract":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <Extract />
            </Container>
          </Box>
        );
      case "history":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <History />
            </Container>
          </Box>
        );
      case "encoder":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4 }}>
                Medical Image Encoding
              </Typography>
              <Typography variant="h5" color="text.secondary" paragraph sx={{ mb: 6, maxWidth: "800px" }}>
                Securely embed patient information, metadata, and integrity signatures into medical images
                using our advanced autoencoder-based reversible watermarking system.
              </Typography>
              <AutoencoderCard />
            </Container>
          </Box>
        );
      case "results":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#e6f1ff" }}>
                Results & Performance Analysis
              </Typography>
              <Typography variant="h5" color="text.secondary" paragraph sx={{ mb: 6, maxWidth: "800px" }}>
                Comprehensive evaluation of our autoencoder-based watermarking system across multiple datasets
                and comparative analysis with state-of-the-art methods.
              </Typography>
              <ResultsDisplay />
            </Container>
          </Box>
        );
      case "model":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#e6f1ff" }}>
                Model Architecture & Methodology
              </Typography>
              <Typography variant="h5" color="text.secondary" paragraph sx={{ mb: 6, maxWidth: "800px" }}>
                Deep convolutional autoencoder with symmetric embedding-retrieval mechanism designed
                specifically for medical image security and reversible data hiding.
              </Typography>
              <ModelInfo />
            </Container>
          </Box>
        );
      case "medical":
        return (
          <Box sx={{ pt: 12, pb: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#e6f1ff" }}>
                Medical Applications & Clinical Integration
              </Typography>
              <Typography variant="h5" color="text.secondary" paragraph sx={{ mb: 6, maxWidth: "800px" }}>
                Secure and reversible data hiding solutions for DICOM images in healthcare systems,
                telemedicine, PACS integration, and clinical research workflows.
              </Typography>
              <MedicalApplication />
            </Container>
          </Box>
        );
      case "login":
        return <Login setActivePage={setActivePage} setIsLoggedIn={setIsLoggedIn} showNotification={showNotification} />;
      case "register":
        return <Register setActivePage={setActivePage} setIsLoggedIn={setIsLoggedIn} showNotification={showNotification} />;
      default:
        return <Home setActivePage={setActivePage} />;
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="app-container">
        {isLoggedIn && (
          <Navbar
            activePage={activePage}
            setActivePage={setActivePage}
            isLoggedIn={isLoggedIn}
            setIsLoggedIn={setIsLoggedIn}
            showNotification={showNotification}
          />
        )}

        <main className="main-content">
          {renderContent()}
        </main>

        <Snackbar
          open={notification.open}
          autoHideDuration={4000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseNotification}
            severity={notification.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </div>
    </ThemeProvider>
  );
}

export default App;