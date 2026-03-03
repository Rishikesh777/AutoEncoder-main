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

// Create light theme
const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
    },
    secondary: {
      main: "#0288d1",
      light: "#4fc3f7",
      dark: "#01579b",
    },
    background: {
      default: "#ffffff",
      paper: "#f8f9fa",
    },
    text: {
      primary: "#1a365d",
      secondary: "#2d3748",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 800,
      fontSize: "3.5rem",
      color: "#1a365d",
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 700,
      fontSize: "2.5rem",
      color: "#1a365d",
      marginBottom: "1rem",
    },
    h3: {
      fontWeight: 600,
      fontSize: "2rem",
      color: "#2d3748",
      marginBottom: "0.75rem",
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.5rem",
      color: "#2d3748",
      marginBottom: "0.5rem",
    },
    body1: {
      fontSize: "1.1rem",
      lineHeight: 1.7,
      color: "#4a5568",
    },
    body2: {
      fontSize: "1rem",
      lineHeight: 1.6,
      color: "#718096",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
          border: "1px solid #e2e8f0",
          transition: "all 0.3s ease",
          "&:hover": {
            transform: "translateY(-5px)",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none",
          borderRadius: 8,
          padding: "10px 24px",
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
        return <Register setActivePage={setActivePage} setIsLoggedIn={setIsLoggedIn} showNotification={showNotification} />;
      }
      return <Login setActivePage={setActivePage} setIsLoggedIn={setIsLoggedIn} showNotification={showNotification} />;
    }

    switch (activePage) {
      case "home":
        return <Home setActivePage={setActivePage} />;
      case "embed":
        return (
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Embed />
            </Container>
          </Box>
        );
      case "extract":
        return (
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Extract />
            </Container>
          </Box>
        );
      case "history":
        return (
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <History />
            </Container>
          </Box>
        );
      case "encoder":
        return (
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#1a365d" }}>
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
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#1a365d" }}>
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
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#1a365d" }}>
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
          <Box sx={{ py: 8 }}>
            <Container maxWidth="lg">
              <Typography variant="h1" component="h1" gutterBottom sx={{ mb: 4, color: "#1a365d" }}>
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
    <ThemeProvider theme={lightTheme}>
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