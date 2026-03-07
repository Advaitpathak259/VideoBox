import React from "react";
import { Card, CardContent, Typography } from "@mui/material";

export default function FeatureCard({ title, description }) {
  return (
    <Card
      sx={{
        borderRadius: 4,
        p: 2,
        transition: "0.3s",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: 6,
        },
      }}
    >
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>

        <Typography variant="body2" sx={{ mt: 1 }}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}