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
    {
      word: "LiteChat",
      color:
        "bg-gradient-to-tr from-lime-500 via-amber-400 to-red-600 bg-clip-text text-transparent",
    },
    { word: "library", color: "text-emerald-500" },
    { word: "browser", color: "text-violet-500" },
    { word: "local", color: "text-amber-500" },
    { word: "remote", color: "text-sky-500" },
    { word: "providers", color: "text-purple-500" },
    {
      word: " AI ",
      color:
        "bg-gradient-to-b from-amber-300 to-rose-700 bg-clip-text text-transparent",
    },
    {
      word: "Open Source",
      color:
        "bg-gradient-to-r from-lime-500 to-yellow-500 bg-clip-text text-transparent",
    },
  ];

  const highlightText = (text: string | React.ReactNode) => {
    let parts: React.ReactNode[] = [text];

    // Highlight keywords
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

    // De-emphasize parenthetical text
    parts = parts.reduce<React.ReactNode[]>((acc, part, partIndex) => {
      if (typeof part !== "string") {
        acc.push(part);
        return acc;
      }

      const regex = /(\([^)]*\))/g;
      const split = part.split(regex);

      split.forEach((sub, i) => {
        if (regex.test(sub)) {
          acc.push(
            <span
              key={`paren-${partIndex}-${i}`}
              className="text-sm text-muted"
            >
              {sub}
            </span>,
          );
        } else {
          acc.push(sub);
        }
      });

      return acc;
    }, []);

    return parts;
  };

  const rantTexts = [
    "Oh, hey?! Hi there!! How are you doing!?",
    "Nice of you to pop by to checkout LiteChat!",
    "What'd you mean you don't know what LiteChat is? Oh Boy hey, you in for a treat!",
    "To start with, it's an(other) AI chat app (yes...shocker, right ?) and it's Open Source ! ",
    "But, it is also an extensible library, so you can go on and create your own, AI chat app! With your own functionnalities !",
    "(are AI chat apps the new JS frameworks?)",
    "And cause I might be a wee bit on the reluctant side when it comes to parting with my coins, it doesn't require no servers! It all stays in your browser.",
    "(that means I couldn't snoop on what you do here, even if I wanted to!)",
    "While able to run LLM both local (did I tell you I ain't liking throwing coins out?) and from remote providers",
    "(but sometimes you have to :(..)",
    "To cap things off, there is no fancy/crazy tech involved, I just glued bricks together with AI",
    "(kids call it vibing apparently ^^)",
    "Enough of this interminable babble! Go setup your future chat to prompt your brains out!",
  ];

  return (
    <motion.div
      className="text-center max-w-4xl mx-auto space-y-3 my-6"
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
