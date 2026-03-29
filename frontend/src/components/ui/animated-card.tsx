"use client";

import { motion } from "framer-motion";
import { Card } from "./card";

export function AnimatedCard({
  children,
  className,
  delay = 0,
  ...props
}: React.ComponentProps<typeof Card> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    >
      <Card className={className} {...props}>
        {children}
      </Card>
    </motion.div>
  );
}
