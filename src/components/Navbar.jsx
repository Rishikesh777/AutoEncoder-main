import { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Container,
  useMediaQuery,
  useTheme,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  ListItemIcon,
  Divider,
} from "@mui/material";
import {
  Search as SearchIcon,
  Security,
  Menu as MenuIcon,
  Home,
  History as HistoryIcon,
  LockOutlined,
  AccountCircle,
  Settings,
  ExitToApp,
  DeleteForever,
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  DateRange,
  Edit,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

// Removed Search styled components as per request

const NavButton = ({ active, children, ...props }) => (
  <Button
    {...props}
    sx={{
      color: active ? "#00d4ff" : "#e6f1ff",
      fontWeight: active ? 700 : 500,
      mx: 1,
      px: 2,
      py: 1,
      borderRadius: 2,
      "&:hover": {
        backgroundColor: active ? "rgba(0, 212, 255, 0.15)" : "rgba(255, 255, 255, 0.1)",
        transform: "translateY(-1px)",
      },
      transition: "all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1)",
      position: "relative",
      "&::after": active ? {
        content: '""',
        position: "absolute",
        bottom: 2,
        left: "15%",
        right: "15%",
        height: "2px",
        backgroundColor: "#00d4ff",
        borderRadius: 1,
      } : {},
    }}
  >
    {children}
  </Button>
);

function Navbar({ activePage, setActivePage, isLoggedIn, setIsLoggedIn, showNotification }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [updateType, setUpdateType] = useState(null); // 'email' or 'password'
  const [updateFormData, setUpdateFormData] = useState({
    currentPassword: "",
    newEmail: "",
    newPassword: "",
    confirmNewPassword: ""
  });
  const [deletePassword, setDeletePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const getUserInfo = () => {
    try {
      const info = localStorage.getItem("user_info");
      return info ? JSON.parse(info) : null;
    } catch { return null; }
  };

  const getFirstName = () => {
    const user = getUserInfo();
    if (user && user.name) {
      return user.name.split(" ")[0];
    }
    return "User";
  };

  const handleLogout = () => {
    setUserMenuAnchor(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setIsLoggedIn(false);
    setActivePage("login");
    showNotification("You are signed out", "info");
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showNotification("Please enter your password", "error");
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/auth/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete account");
      }

      setShowDeleteDialog(false);
      setShowSettingsDialog(false);
      setUserMenuAnchor(null);
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_info");
      setIsLoggedIn(false);
      setActivePage("login");
      showNotification("Account deleted successfully", "success");
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsDeleting(false);
      setDeletePassword("");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (updateType === 'password' && updateFormData.newPassword !== updateFormData.confirmNewPassword) {
      showNotification("New passwords do not match", "error");
      return;
    }

    setIsUpdating(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/auth/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: updateFormData.currentPassword,
          newEmail: updateType === 'email' ? updateFormData.newEmail : undefined,
          newPassword: updateType === 'password' ? updateFormData.newPassword : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Update failed");
      }

      showNotification("Profile updated successfully", "success");
      setUpdateType(null);
      setUpdateFormData({ currentPassword: "", newEmail: "", newPassword: "", confirmNewPassword: "" });
      fetchProfile(); // Refresh details

      if (data.user) {
        localStorage.setItem("user_info", JSON.stringify(data.user));
      }
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const navItems = [
    { id: "home", label: "Home", icon: <Home sx={{ mr: 1 }} /> },
    { id: "embed", label: "Embed", icon: <LockOutlined sx={{ mr: 1 }} /> },
    { id: "extract", label: "Extract", icon: <SearchIcon sx={{ mr: 1 }} /> },
    { id: "history", label: "History", icon: <HistoryIcon sx={{ mr: 1 }} /> },
  ];

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    handleMobileMenuClose();
  };

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          background: 'rgba(8, 18, 31, 0.9)',
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0, 212, 255, 0.05)",
          borderBottom: "1px solid rgba(0, 212, 255, 0.08)",
          zIndex: 1300,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ py: 1 }}>
            {/* Logo */}
            <Box
              sx={{
                mr: 3,
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                padding: "8px 12px",
                borderRadius: "12px",
                background: "rgba(0, 212, 255, 0.05)",
                border: "1px solid rgba(0, 212, 255, 0.1)",
                "&:hover": {
                  background: "rgba(0, 212, 255, 0.1)",
                  transform: "scale(1.02)",
                  borderColor: "rgba(0, 212, 255, 0.3)",
                },
                transition: "all 0.2s ease",
              }}
              onClick={() => setActivePage("home")}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  mr: 1,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <Security sx={{ color: "#00d4ff", fontSize: "1.8rem" }} />
              </Box>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 900,
                  letterSpacing: "-0.5px",
                  color: "white",
                  fontSize: "1.2rem",
                  textTransform: "uppercase",
                }}
              >
                Auto<span style={{ color: "#ffd60a" }}>Vault</span>
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            <Box sx={{
              flexGrow: 1,
              display: { xs: "none", md: "flex" },
              justifyContent: "center",
              alignItems: "center"
            }}>
              {navItems.map((item) => (
                <NavButton
                  key={item.id}
                  active={activePage === item.id}
                  onClick={() => setActivePage(item.id)}
                  startIcon={item.icon}
                >
                  {item.label}
                </NavButton>
              ))}
            </Box>

            {/* Search Bar Removed */}

            {/* Mobile Menu Button */}
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={handleMobileMenuOpen}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Notification Bell Removed */}

            {/* User Actions */}
            <Box sx={{ flexGrow: 0 }}>
              {isLoggedIn ? (
                <>
                  <Button
                    onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                    sx={{
                      color: "white",
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "12px",
                      px: 2,
                      py: 1,
                      textTransform: "none",
                      fontWeight: 600,
                      fontSize: "1rem",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      "&:hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.25)",
                        boxShadow: "0 0 12px rgba(255,255,255,0.2)",
                      },
                      transition: "all 0.2s ease",
                    }}
                    title="Account menu"
                  >
                    Hi, {getFirstName()}
                  </Button>
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={() => setUserMenuAnchor(null)}
                    PaperProps={{
                      sx: {
                        mt: 1.5,
                        minWidth: 240,
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.12)",
                        borderRadius: "16px",
                        border: "1px solid rgba(0,0,0,0.05)",
                        overflow: "visible",
                        "&:before": {
                          content: '""',
                          display: "block",
                          position: "absolute",
                          top: 0,
                          right: 24,
                          width: 10,
                          height: 10,
                          bgcolor: "background.paper",
                          transform: "translateY(-50%) rotate(45deg)",
                          zIndex: 0,
                        },
                      },
                    }}
                    transformOrigin={{ horizontal: "right", vertical: "top" }}
                    anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                  >
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ color: "text.secondary", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Personal Space
                      </Typography>
                    </Box>
                    <MenuItem onClick={() => { setUserMenuAnchor(null); setShowProfileDialog(true); fetchProfile(); }} sx={{ py: 1.5, borderRadius: "10px", mx: 1 }}>
                      <ListItemIcon>
                        <AccountCircle fontSize="small" />
                      </ListItemIcon>
                      <Typography variant="body2" fontWeight={500}>My Profile</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => { setUserMenuAnchor(null); setShowSettingsDialog(true); }} sx={{ py: 1.5, borderRadius: "10px", mx: 1 }}>
                      <ListItemIcon>
                        <Settings fontSize="small" />
                      </ListItemIcon>
                      <Typography variant="body2" fontWeight={500}>Account Settings</Typography>
                    </MenuItem>
                    <Divider sx={{ my: 1, opacity: 0.6 }} />
                    <MenuItem
                      onClick={handleLogout}
                      sx={{
                        py: 1.5,
                        mx: 1,
                        borderRadius: "10px",
                        color: "#d32f2f",
                        "&:hover": { backgroundColor: "rgba(211, 47, 47, 0.08)" },
                      }}
                    >
                      <ListItemIcon>
                        <ExitToApp fontSize="small" sx={{ color: "#d32f2f" }} />
                      </ListItemIcon>
                      <Typography variant="body2" fontWeight={600}>Sign Out</Typography>
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => setActivePage("login")}
                  sx={{
                    background: "#00d4ff",
                    color: "#020c1b",
                    fontWeight: 700,
                    px: 4,
                    py: 1,
                    borderRadius: "8px",
                    "&:hover": {
                      background: "#33ddff",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  Sign In
                </Button>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Menu */}
      <Menu
        anchorEl={mobileMenuAnchor}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMobileMenuClose}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: 250,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
          },
        }}
      >
        {navItems.map((item) => (
          <MenuItem
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            selected={activePage === item.id}
            sx={{
              py: 1.5,
              px: 2,
              "&.Mui-selected": {
                backgroundColor: "rgba(25, 118, 210, 0.1)",
                "&:hover": {
                  backgroundColor: "rgba(25, 118, 210, 0.15)",
                },
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", color: activePage === item.id ? "#1976d2" : "inherit" }}>
              {item.icon}
              <Typography variant="body1" fontWeight={activePage === item.id ? 600 : 400}>
                {item.label}
              </Typography>
            </Box>
          </MenuItem>
        ))}
        <Box sx={{ px: 2, py: 1.5 }}>
          {isLoggedIn ? (
            <Button
              fullWidth
              variant="outlined"
              onClick={handleLogout}
              sx={{ color: "#d32f2f", borderColor: "#d32f2f" }}
            >
              Logout
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                setActivePage("login");
                handleMobileMenuClose();
              }}
              sx={{ background: "linear-gradient(135deg, #1976d2, #1565c0)" }}
            >
              Sign In
            </Button>
          )}
        </Box>
      </Menu>

      {/* User Profile Dialog */}
      <Dialog
        open={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        PaperProps={{
          sx: { borderRadius: "20px", padding: 1, minWidth: { xs: "90%", sm: "450px" } }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a365d", display: "flex", alignItems: "center", gap: 1.5 }}>
          <AccountCircle sx={{ fontSize: "2rem", color: "#1976d2" }} />
          User Profile
        </DialogTitle>
        <DialogContent>
          {profileData ? (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4, p: 2, bgcolor: "#112d4e", borderRadius: "12px" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Edit sx={{ color: "text.secondary", fontSize: "1.2rem" }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Full Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{profileData.name}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <EmailIcon sx={{ color: "text.secondary", fontSize: "1.2rem" }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Email Address</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{profileData.email}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <DateRange sx={{ color: "text.secondary", fontSize: "1.2rem" }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Member Since</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: "#1a365d" }}>
                Update Information
              </Typography>

              <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                <Button
                  variant={updateType === 'email' ? 'contained' : 'outlined'}
                  onClick={() => setUpdateType(updateType === 'email' ? null : 'email')}
                  fullWidth
                  sx={{ borderRadius: "8px", textTransform: "none" }}
                >
                  Change Email
                </Button>
                <Button
                  variant={updateType === 'password' ? 'contained' : 'outlined'}
                  onClick={() => setUpdateType(updateType === 'password' ? null : 'password')}
                  fullWidth
                  sx={{ borderRadius: "8px", textTransform: "none" }}
                >
                  Change Password
                </Button>
              </Box>

              {updateType && (
                <Box component="form" onSubmit={handleUpdateProfile} sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2, border: "1px solid #e2e8f0", borderRadius: "12px" }}>
                  {updateType === 'email' && (
                    <TextField
                      fullWidth
                      label="New Email"
                      type="email"
                      value={updateFormData.newEmail}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, newEmail: e.target.value })}
                      required
                    />
                  )}
                  {updateType === 'password' && (
                    <>
                      <TextField
                        fullWidth
                        label="New Password"
                        type="password"
                        value={updateFormData.newPassword}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, newPassword: e.target.value })}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Confirm New Password"
                        type="password"
                        value={updateFormData.confirmNewPassword}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, confirmNewPassword: e.target.value })}
                        required
                      />
                    </>
                  )}
                  <TextField
                    fullWidth
                    label="Current Password"
                    type="password"
                    value={updateFormData.currentPassword}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, currentPassword: e.target.value })}
                    required
                    helperText="Required to save changes"
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isUpdating}
                    sx={{ mt: 1, borderRadius: "8px", py: 1.2, bgcolor: "#1976d2" }}
                  >
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Typography>Loading details...</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setShowProfileDialog(false)} sx={{ fontWeight: 600, color: "text.secondary" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Settings Dialog */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        PaperProps={{
          sx: { borderRadius: "20px", padding: 1, minWidth: "350px" }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: "1.5rem", color: "#1a365d" }}>
          Account Settings
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
            Manage your account preferences and security settings.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="error" sx={{ fontWeight: 700, mb: 1 }}>
              Danger Zone
            </Typography>
            <Button
              variant="outlined"
              color="error"
              fullWidth
              startIcon={<DeleteForever />}
              onClick={() => setShowDeleteDialog(true)}
              sx={{
                borderRadius: "10px",
                borderWidth: "2px",
                "&:hover": { borderWidth: "2px", backgroundColor: "rgba(211, 47, 47, 0.05)" },
                textTransform: "none",
                fontWeight: 700
              }}
            >
              Delete My Account
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setShowSettingsDialog(false)} sx={{ fontWeight: 600, color: "text.secondary" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => !isDeleting && setShowDeleteDialog(false)}
        PaperProps={{
          sx: { borderRadius: "20px", padding: 1 }
        }}
      >
        <DialogTitle sx={{ color: "#d32f2f", fontWeight: 800 }}>
          Permanently Delete Account?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            This action is irreversible. All your data will be permanently removed.
            Please enter your password to confirm.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            disabled={isDeleting}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              )
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
            sx={{ fontWeight: 600, color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            variant="contained"
            color="error"
            disabled={isDeleting || !deletePassword}
            sx={{
              borderRadius: "10px",
              px: 3,
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(211, 47, 47, 0.2)"
            }}
          >
            {isDeleting ? "Deleting..." : "Confirm Deletion"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Spacer for fixed navbar */}
      <Toolbar />
    </>
  );
}

export default Navbar;