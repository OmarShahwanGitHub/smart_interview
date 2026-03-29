"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import FloatingOrbs from "@/components/3d/FloatingOrbs";
import { Sparkles, Brain, Mic, Video } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-8 overflow-hidden">
      <FloatingOrbs />

      <div className="max-w-4xl text-center space-y-12 z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Interview Practice</span>
          </motion.div>

          <h1 className="text-6xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-cyan-500 bg-clip-text text-transparent">
            Smart Interview
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Master your interviews with personalized technical and behavioral questions tailored to your resume.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
        >
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm"
          >
            <Brain className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-2">Resume-Driven Questions</h3>
            <p className="text-sm text-muted-foreground">
              Questions generated from your actual experience and skills
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm"
          >
            <Mic className="h-8 w-8 text-purple-500 mb-3" />
            <h3 className="font-semibold mb-2">Voice & Text Support</h3>
            <p className="text-sm text-muted-foreground">
              Practice in English or Spanish with AI voice feedback
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 rounded-2xl bg-card border border-border backdrop-blur-sm"
          >
            <Video className="h-8 w-8 text-cyan-500 mb-3" />
            <h3 className="font-semibold mb-2">ASL Support</h3>
            <p className="text-sm text-muted-foreground">
              Full American Sign Language interview practice
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex gap-4 justify-center"
        >
          <Link href="/login">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" size="lg" className="text-lg px-8">
                Log In
              </Button>
            </motion.div>
          </Link>
          <Link href="/signup">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                Get Started
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none" />
    </main>
  );
}
