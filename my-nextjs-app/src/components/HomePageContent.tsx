"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { Widget } from "../../packages/ui/src/DashboardBuilder/DashboardBuilder"; // Re-enable Widget
import { SkeletonLoader } from "../../packages/ui/src/SkeletonLoader/SkeletonLoader"; 
import { motion } from 'framer-motion'; // AnimatePresence removed as it's not used when DashboardBuilder is simplified
// import { useTheme } from 'next-themes'; // theme is unused
import { ArrowRight, BarChart, PieChart, Users, TrendingUp } from 'lucide-react'; // TrendingDown is unused
import dynamic from 'next/dynamic';
import DashboardBuilder from "../../packages/ui/src/DashboardBuilder/DashboardBuilder"; // Re-enable DashboardBuilder

// Lazy-load heavy components
const ClientHomePageContent = dynamic(() => import('./ClientHomePageContent'), { ssr: false });

// Dynamically import directly from recharts, casting through unknown to React.ComponentType<any>
// const PieChartComponent = dynamic(() => import('recharts').then(mod => mod.PieChart as unknown as React.ComponentType<any>), { ssr: false });
// const Pie = dynamic(() => import('recharts').then(mod => mod.Pie as unknown as React.ComponentType<any>), { ssr: false });
// const Cell = dynamic(() => import('recharts').then(mod => mod.Cell as unknown as React.ComponentType<any>), { ssr: false });


const HomePageContent: React.FC = () => {
  // const { theme } = useTheme(); // theme is unused
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 

  // Mock data for the pie chart (still needed if initialDashboardLayout refers to it, but chart itself is commented)
  // const pieChartData = [ // pieChartData is unused
  //   { name: 'North America', value: 400 },
  //   { name: 'Europe', value: 300 },
  //   { name: 'Asia', value: 200 },
  //   { name: 'Other', value: 100 },
  // ];
  // const COLORS = ['#00F0FF', '#34D399', '#FBBF24', '#F87171']; // COLORS is unused

  const initialDashboardLayout: Widget[] = [ // Re-enable initialDashboardLayout
    {
      id: 'kpi1',
      type: 'kpi',
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      config: { title: 'Revenue', value: 125000, trend: 'up', icon: <TrendingUp /> },
    },
    {
      id: 'kpi2',
      type: 'kpi',
      x: 2,
      y: 0,
      w: 2,
      h: 2,
      config: { title: 'Active Users', value: 5400, trend: 'down', icon: <Users /> },
    },
    {
      id: 'chart1', // This widget is of type 'chart' and refers to 'pie'
      type: 'chart', // DashboardBuilder might try to render this based on type
      x: 0,
      y: 2,
      w: 4,
      h: 3,
      config: { title: 'Sales Distribution', chartType: 'pie', icon: <PieChart /> },
    },
  ];

  useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setIsLoading(false), 1500); 
    return () => clearTimeout(timer);
  }, []);

  if (!isMounted) return null;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-8"
      aria-labelledby="main-heading"
    >
      {/* Hero Section */}
      <section className="text-center py-16" aria-labelledby="hero-heading">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 id="hero-heading" className="text-5xl font-bold mb-6 text-onBackground">
            Empower Your Enterprise with SEED-OS
          </h1>
          <p className="text-xl mb-8 text-onSurface max-w-2xl mx-auto">
            A scalable, sovereign, and AI-driven business operating system designed to transform your operations with clarity, control, and foresight.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-primary text-background font-semibold px-8 py-3 rounded-lg shadow-lg hover:bg-primary-hover transition-colors duration-300"
            aria-label="Get started with SEED-OS"
          >
            Get Started
            <ArrowRight className="inline-block ml-2" size={20} />
          </motion.button>
        </motion.div>
        <motion.div
          className="mt-12"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.7 }}
        >
          <div className="bg-surface rounded-lg shadow-xl p-8 h-64 flex items-center justify-center">
            <BarChart size={64} className="text-primary" />
          </div>
        </motion.div>
      </section>

      {/* Dashboard Preview Section - Now using DashboardBuilder */}
      <section className="py-16" aria-labelledby="dashboard-preview-heading">
        <div className="text-center mb-12">
          <h2 id="dashboard-preview-heading" className="text-4xl font-bold mb-4 text-onBackground">
            Your Command Center
          </h2>
          <p className="text-lg text-onSurface max-w-xl mx-auto">
            Visualize your business metrics with a fully customizable dashboard, powered by AI-driven insights and real-time data.
          </p>
        </div>
        {/* Render DashboardBuilder directly if not loading, or its own skeleton/suspense */}
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {initialDashboardLayout.map(widget => (
                    <SkeletonLoader key={widget.id} className={`rounded-lg shadow-lg ${widget.h === 2 ? 'h-48' : 'h-72'}`} />
                ))}
            </div>
        ) : (
            <DashboardBuilder initialLayout={initialDashboardLayout} data-testid="main-dashboard" />
        )}
      </section>

      {/* Client Home Page Content */}
      <section className="py-16" aria-labelledby="client-content-heading">
        <Suspense fallback={<SkeletonLoader className="h-96 rounded-lg" />}>
          <ClientHomePageContent />
        </Suspense>
      </section>

      {/* CTA Section */}
      <section className="bg-surface rounded-lg shadow-xl p-12 my-16 text-center" aria-labelledby="cta-heading">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 id="cta-heading" className="text-3xl font-bold mb-4 text-onBackground">
            Ready to Transform Your Business?
          </h2>
          <p className="text-lg mb-8 text-onSurface max-w-md mx-auto">
            Join thousands of enterprises leveraging SEED-OS to achieve unparalleled efficiency and growth.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-primary text-background font-semibold px-8 py-3 rounded-lg shadow-lg hover:bg-primary-hover transition-colors duration-300"
            aria-label="Schedule a demo for SEED-OS"
          >
            Schedule a Demo
            <ArrowRight className="inline-block ml-2" size={20} />
          </motion.button>
        </motion.div>
      </section>
    </motion.main>
  );
};

export default HomePageContent;
