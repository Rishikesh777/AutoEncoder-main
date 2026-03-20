import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Tooltip,
} from "@mui/material";
import {
    History as HistoryIcon,
    Download,
    Visibility,
    DeleteOutline,
    ContentCopy,
    ImageOutlined,
} from "@mui/icons-material";
import { getHistory, deleteHistoryEntry, clearHistory } from "../utils/history";

const History = () => {
    const [history, setHistory] = useState([]);
    const [viewingEntry, setViewingEntry] = useState(null);

    useEffect(() => {
        setHistory(getHistory());
    }, []);

    const handleDelete = (id) => {
        if (deleteHistoryEntry(id)) {
            setHistory(getHistory());
        }
    };

    const handleClearAll = () => {
        if (window.confirm("Are you sure you want to clear all history?")) {
            clearHistory();
            setHistory([]);
        }
    };

    const handleDownload = (entry) => {
        const link = document.createElement("a");
        if (entry.type === "Embed" && entry.resultImage) {
            link.href = entry.resultImage;
            link.download = `watermarked_${entry.imageName}`;
        } else {
            const file = new Blob([entry.data || ""], { type: "text/plain" });
            link.href = URL.createObjectURL(file);
            link.download = `extracted_data_${entry.id}.txt`;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const getStatusChip = (status) => (
        <Chip
            label={status}
            color={status === "Success" ? "success" : "error"}
            size="small"
            variant="outlined"
            sx={{ borderRadius: "8px", fontWeight: 600 }}
        />
    );

    const getTypeChip = (type) => (
        <Chip
            label={type}
            color={type === "Embed" ? "primary" : "info"}
            size="small"
            sx={{ fontWeight: "bold", borderRadius: "8px" }}
        />
    );

    return (
        <Box sx={{ width: "100%", py: 4 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
                <Box>
                    <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, color: "#e6f1ff" }}>
                        Operation History
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage your previous data embedding and extraction tasks.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    {history.length > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutline />}
                            onClick={handleClearAll}
                            sx={{ borderRadius: "12px", textTransform: "none" }}
                        >
                            Clear All
                        </Button>
                    )}
                </Stack>
            </Box>

            <TableContainer
                component={Paper}
                sx={{
                    borderRadius: "20px",
                    overflow: "auto",
                    bgcolor: "#0a192f",
                    border: "1px solid rgba(0, 212, 255, 0.1)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}
            >
                <Table sx={{ minWidth: 800 }}>
                    <TableHead sx={{ bgcolor: "rgba(0, 212, 255, 0.05)" }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, color: "#8892b0" }}>ID</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#8892b0" }}>Date & Time</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#8892b0" }}>Operation</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#8892b0" }}>Target Image</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "#8892b0" }}>Status</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, color: "#8892b0", minWidth: 150 }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {history.length > 0 ? (
                            history.map((row) => (
                                <TableRow
                                    key={row.id}
                                    hover
                                    sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                                >
                                    <TableCell
                                        sx={{
                                            fontWeight: 600,
                                            color: row.type === "Embed" ? "#00d4ff" : "#FFD60A",
                                        }}
                                    >
                                        {row.id}
                                    </TableCell>
                                    <TableCell sx={{ color: "#8892b0" }}>{row.date}</TableCell>
                                    <TableCell>{getTypeChip(row.type)}</TableCell>
                                    <TableCell sx={{ fontWeight: 500, color: "#e6f1ff" }}>{row.imageName}</TableCell>
                                    <TableCell>{getStatusChip(row.status)}</TableCell>
                                    <TableCell align="center">
                                        <Stack direction="row" spacing={1} justifyContent="center">
                                            <Tooltip title="View Details">
                                                <IconButton
                                                    onClick={() => setViewingEntry(row)}
                                                    size="small"
                                                    sx={{ color: "#00d4ff", "&:hover": { bgcolor: "rgba(0, 212, 255, 0.1)" } }}
                                                >
                                                    <Visibility sx={{ fontSize: 20 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Download Result">
                                                <IconButton
                                                    onClick={() => handleDownload(row)}
                                                    size="small"
                                                    sx={{ color: "#e6f1ff", "&:hover": { bgcolor: "rgba(255, 255, 255, 0.05)" } }}
                                                >
                                                    <Download sx={{ fontSize: 20 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    onClick={() => handleDelete(row.id)}
                                                    size="small"
                                                    sx={{ color: "#ff4d4d", "&:hover": { bgcolor: "rgba(255, 77, 77, 0.1)" } }}
                                                >
                                                    <DeleteOutline sx={{ fontSize: 20 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                                    <HistoryIcon sx={{ fontSize: 60, color: "#112d4e", mb: 2 }} />
                                    <Typography color="text.secondary" variant="h6">
                                        No operation history found.
                                    </Typography>
                                    <Typography color="text.secondary" variant="body2">
                                        Your embedding and extraction tasks will appear here.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* View Details Dialog */}
            <Dialog
                open={Boolean(viewingEntry)}
                onClose={() => setViewingEntry(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { bgcolor: "#0a192f", color: "#e6f1ff", borderRadius: "24px", p: 1, border: "1px solid rgba(0, 212, 255, 0.1)" } }}
            >
                {viewingEntry && (
                    <>
                        <DialogTitle sx={{ fontWeight: 800, fontSize: "1.5rem" }}>
                            Operation Details - {viewingEntry.id}
                        </DialogTitle>
                        <DialogContent>
                            <Stack spacing={3} sx={{ mt: 1 }}>
                                <Box>
                                    <Typography
                                        variant="caption"
                                        sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}
                                    >
                                        Operation Type
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {viewingEntry.type} Data Task
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography
                                        variant="caption"
                                        sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}
                                    >
                                        Image File
                                    </Typography>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <ImageOutlined sx={{ color: "#94a3b8" }} />
                                        <Typography variant="body1">{viewingEntry.imageName}</Typography>
                                    </Stack>
                                </Box>

                                <Box>
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        sx={{ mb: 1 }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}
                                        >
                                            {viewingEntry.type === "Embed" ? "Hidden Data" : "Extracted Information"}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => copyToClipboard(viewingEntry.data || "")}
                                        >
                                            <ContentCopy sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Stack>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            borderRadius: "12px",
                                            bgcolor: "#112d4e",
                                            color: "#e6f1ff",
                                            fontFamily: "monospace",
                                            maxHeight: 200,
                                            overflow: "auto",
                                            border: "1px solid rgba(0, 212, 255, 0.1)"
                                        }}
                                    >
                                        {viewingEntry.data || (
                                            <em style={{ color: "#94a3b8" }}>No data recorded</em>
                                        )}
                                    </Paper>
                                </Box>

                                {/* Result image preview for Embed entries */}
                                {viewingEntry.type === "Embed" && viewingEntry.resultImage && (
                                    <Box>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 700,
                                                color: "#64748b",
                                                textTransform: "uppercase",
                                                display: "block",
                                                mb: 1,
                                            }}
                                        >
                                            Result Preview
                                        </Typography>
                                        <Box
                                            component="img"
                                            src={viewingEntry.resultImage}
                                            sx={{
                                                width: "100%",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(0, 212, 255, 0.1)",
                                            }}
                                        />
                                    </Box>
                                )}

                                {/* Security metadata */}
                                {viewingEntry.metadata && (
                                    <Box>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 700,
                                                color: "#64748b",
                                                textTransform: "uppercase",
                                                display: "block",
                                                mb: 1,
                                            }}
                                        >
                                            Security Metadata
                                        </Typography>
                                        <Paper
                                            variant="outlined"
                                            sx={{ p: 2, borderRadius: "12px", bgcolor: "#112d4e", border: "1px solid rgba(0, 212, 255, 0.1)" }}
                                        >
                                            {Object.entries(viewingEntry.metadata).map(
                                                ([key, value]) =>
                                                    value && (
                                                        <Box
                                                            key={key}
                                                            sx={{
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                mb: 0.5,
                                                            }}
                                                        >
                                                            <Typography variant="caption" color="text.secondary">
                                                                {key}:
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                fontFamily="monospace"
                                                                fontWeight={600}
                                                            >
                                                                {String(value).substring(0, 24)}
                                                                {String(value).length > 24 ? "..." : ""}
                                                            </Typography>
                                                        </Box>
                                                    )
                                            )}
                                        </Paper>
                                    </Box>
                                )}
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ p: 3 }}>
                            <Button
                                onClick={() => setViewingEntry(null)}
                                sx={{ borderRadius: "12px", textTransform: "none", px: 3 }}
                            >
                                Close
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => handleDownload(viewingEntry)}
                                startIcon={<Download />}
                                sx={{ borderRadius: "12px", textTransform: "none", px: 3 }}
                            >
                                Download
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
};

export default History;
