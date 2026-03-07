import React from "react";
import ScreenshotCard from "./ScreenshotCard";

const ScreenshotGrid = () => {
  const screenshots = [
    {
      image: "/img1.jpg",
      title: "Video Meetings",
      description: "High quality meetings with screen sharing."
    },
    {
      image: "/img2.jpg",
      title: "Chat System",
      description: "Send messages and collaborate instantly."
    },
    {
      image: "/img3.jpg",
      title: "Screen Sharing",
      description: "Share your screen with team members."
    },
    {
      image: "/img4.jpg",
      title: "Secure Calls",
      description: "End-to-end encrypted communication."
    }
  ];

  return (
    <section className="max-w-[1100px] mx-auto grid md:grid-cols-2 gap-8 py-20 px-6">
      {screenshots.map((item, index) => (
        <ScreenshotCard key={index} {...item} />
      ))}
    </section>
  );
};

export default ScreenshotGrid;