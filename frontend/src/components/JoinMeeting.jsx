import React from "react";
import { Box, TextField, Button, Typography } from "@mui/material";

export default function JoinMeeting() {
  return (
    <Box
      sx={{
        p: 6,
        textAlign: "center",
      }}
    >
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Join a Meeting
      </Typography>

      <TextField
        label="Enter Meeting Code"
        variant="outlined"
        sx={{ width: 300, mr: 2 }}
      />

      <Button
        variant="contained"
        sx={{
          background: "#6366F1",
        }}
      >
        Join
      </Button>
    </Box>
  );
}