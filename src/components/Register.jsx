
import { useState } from "react";
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Container,
    InputAdornment,
    CircularProgress,
    Link,
    Alert,
} from "@mui/material";
import {
    Email,
    Lock,
    Visibility,
    VisibilityOff,
    PersonAdd,
    Badge,
} from "@mui/icons-material";

function Register({ setActivePage, setIsLoggedIn, showNotification }) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            showNotification('Registration successful! Please sign in.', 'success');
            setActivePage("login");

        } catch (err) {
            setError(err.message);
            showNotification(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 6,
                    marginBottom: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        p: 4,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: "100%",
                        borderRadius: 4,
                        backgroundColor: "#0a192f",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                        border: "1px solid rgba(0, 212, 255, 0.1)",
                    }}
                >
                    <Box
                        sx={{
                            m: 1,
                            bgcolor: "rgba(0, 212, 255, 0.1)",
                            color: "#00d4ff",
                            p: 2,
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <PersonAdd />
                    </Box>
                    <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: 700, color: "#e6f1ff" }}>
                        Create Account
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: "100%" }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="name"
                            label="Full Name"
                            name="name"
                            autoComplete="name"
                            autoFocus
                            value={formData.name}
                            onChange={handleChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Badge color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                }
                            }}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={handleChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Email color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                }
                            }}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={formData.password}
                            onChange={handleChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Box
                                            onClick={() => setShowPassword(!showPassword)}
                                            sx={{ cursor: "pointer", color: "action.active" }}
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </Box>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                }
                            }}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="confirmPassword"
                            label="Confirm Password"
                            type={showPassword ? "text" : "password"}
                            id="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                }
                            }}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{
                                mt: 3,
                                mb: 2,
                                py: 1.5,
                                borderRadius: 2,
                                fontSize: "1rem",
                                textTransform: "none",
                                fontWeight: 600,
                                background: "#00d4ff",
                                color: "#020c1b",
                                "&:hover": {
                                    background: "#33ddff",
                                    boxShadow: "0 8px 20px rgba(0, 212, 255, 0.2)",
                                },
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : "Sign Up"}
                        </Button>
                        <Box sx={{ textAlign: "center", mt: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Already have an account?{" "}
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => setActivePage("login")}
                                    sx={{
                                        fontWeight: 600,
                                        textDecoration: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    Sign In
                                </Link>
                            </Typography>
                        </Box>
                    </Box>
                </Paper>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 8, mb: 4 }}>
                    AutoEncoder Portal © {new Date().getFullYear()}
                </Typography>
            </Box>
        </Container>
    );
}

export default Register;
