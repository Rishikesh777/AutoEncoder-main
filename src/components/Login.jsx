
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
    Checkbox,
    FormControlLabel,
    Link,
    Alert,
} from "@mui/material";
import {
    Email,
    Lock,
    Visibility,
    VisibilityOff,
    Login as LoginIcon,
} from "@mui/icons-material";

function Login({ setActivePage, setIsLoggedIn, showNotification }) {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
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
        if (!formData.email || !formData.password) {
            setError("Please fill in all fields");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                }),
            });

            console.log("Response status:", response.status);
            const text = await response.text();
            console.log("Response body:", text);

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Server returned non-JSON: ${text.substring(0, 50)}...`);
            }

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            localStorage.setItem("auth_token", data.token);
            localStorage.setItem("user_info", JSON.stringify(data.user));

            setIsLoggedIn(true);
            showNotification('Successfully logged in!', 'success');
            setActivePage("home");

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
                    marginTop: 8,
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
                        borderRadius: 3,
                        boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
                        border: "1px solid #e2e8f0",
                    }}
                >
                    <Box
                        sx={{
                            m: 1,
                            bgcolor: "primary.main",
                            color: "white",
                            p: 1,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <LoginIcon />
                    </Box>
                    <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: 700, color: "#1a365d" }}>
                        Welcome Back
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
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
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
                            autoComplete="current-password"
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
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                            <FormControlLabel
                                control={<Checkbox value="remember" color="primary" />}
                                label="Remember me"
                            />
                            <Link href="#" variant="body2" sx={{ textDecoration: "none" }}>
                                Forgot password?
                            </Link>
                        </Box>
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
                                background: "linear-gradient(135deg, #1565c0, #1976d2)",
                                boxShadow: "0 4px 12px rgba(25, 118, 210, 0.2)",
                                "&:hover": {
                                    boxShadow: "0 6px 16px rgba(25, 118, 210, 0.3)",
                                },
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
                        </Button>
                        <Box sx={{ textAlign: "center", mt: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Don't have an account?{" "}
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => setActivePage("register")}
                                    sx={{
                                        fontWeight: 600,
                                        textDecoration: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    Register
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

export default Login;
