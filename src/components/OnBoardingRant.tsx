// src/components/OnBoardingRant.tsx
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export const OnBoardingRant: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const paragraph = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const wordHighlights = [
    { word: "LiteChat", color: "text-primary" },
    { word: "library", color: "text-emerald-500" },
    { word: "browser", color: "text-violet-500" },
    { word: "local", color: "text-amber-500" },
    { word: "remote providers", color: "text-sky-500" },
    { word: "AI", color: "text-rose-800" },
  ];

  const highlightText = (text: string | React.ReactNode) => {
    let parts: React.ReactNode[] = [text];

    wordHighlights.forEach(({ word, color }) => {
      parts = parts.reduce<React.ReactNode[]>((acc, part) => {
        if (typeof part !== "string") {
          acc.push(part);
          return acc;
        }

        const splitParts = part.split(new RegExp(`(${word})`, "gi"));
        splitParts.forEach((subPart, i) => {
          if (subPart.toLowerCase() === word.toLowerCase()) {
            acc.push(
              <span key={`${subPart}-${i}`} className={`${color} font-medium`}>
                {subPart}
              </span>,
            );
          } else {
            acc.push(subPart);
          }
        });

        return acc;
      }, []);
    });

    return parts;
  };

  const rantTexts = [
    "Oh, hey?! Hi there!! How are you doing!?",
    "Nice of you to pop by to checkout LiteChat!",
    "What'd you mean you don't know what LiteChat is? Oh Boy hey, you in for a treat!",
    "To start with, it's an(other) AI chat app (yes...)!",
    "But, it is also a library, so you can go on and create your own, AI chat app! (are AI chat apps the new JS frameworks?)",
    "And cause I might be a wee bit on the reluctant side when it comes to parting with my coins, it doesn't require no servers! It all stays in your browser.",
    "(that means I couldn't snoop on what you do here, even if I wanted to!)",
    "While able to run LLM both local (did I tell you I ain't liking throwing coins out?) and from remote providers (but sometimes you have to :(..)",
  ];

  return (
    <motion.div
      className="text-center max-w-2xl mx-auto space-y-3 my-6"
      initial="hidden"
      animate={isVisible ? "show" : "hidden"}
      variants={container}
    >
      <div className="flex justify-center mb-4">
        <Badge
          variant="outline"
          className="px-3 py-1 bg-black/5 dark:bg-white/10 backdrop-blur-sm border-none"
        >
          <Sparkles className="w-4 h-4 mr-2 text-yellow-500" />
          <span className="text-sm">Welcome to your future AI chat</span>
        </Badge>
      </div>

      {rantTexts.map((text, index) => (
        <motion.p
          key={index}
          className={`text-sm md:text-base ${index === 0 ? "font-medium" : ""} leading-relaxed`}
          variants={paragraph}
        >
          {highlightText(text)}
        </motion.p>
      ))}

      <motion.div variants={paragraph} className="pt-2">
        <Badge className="bg-gradient-to-r from-violet-600 to-primary border-none">
          No server required!
        </Badge>
        <Badge className="ml-2 bg-gradient-to-r from-amber-500 to-emerald-500 border-none">
          100% in-browser
        </Badge>
      </motion.div>
    </motion.div>
  );
};
