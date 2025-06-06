'use client';
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { redis } from '@/lib/redis';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import './SankeyDiagram.module.css';

interface SankeyNode {
  name: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyDiagramProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  width?: number;
  height?: number;
  tenantId: string;
  chartId: string;
  'data-testid'?: string;
}

const SankeyDiagram: React.FC<SankeyDiagramProps> = ({
  nodes,
  links,
  width = 600,
  height = 400,
  tenantId,
  chartId,
  'data-testid': dataTestId = 'sankey-diagram',
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    setIsReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !isVisible) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const sankey = d3Sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 5]]);

    // @ts-ignore // d3-sankey types might not perfectly align with d3 types or our data structure
    const { nodes: sankeyNodes, links: sankeyLinks } = sankey({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })).map(link => ({
        source: link.source, // Ensure source/target are node names or indices as expected by d3-sankey
        target: link.target,
        value: link.value
      })),
    });

    const nodeGroup = svg.append('g').attr('role', 'group').attr('aria-label', 'Nodes');
    const linkGroup = svg.append('g').attr('role', 'group').attr('aria-label', 'Links');
    const labelGroup = svg.append('g').attr('role', 'group').attr('aria-label', 'Labels');

    const nodesSelection = nodeGroup
      .selectAll('rect')
      .data(sankeyNodes)
      .join('rect')
      .attr('x', (d: any) => d.x0!)
      .attr('y', (d: any) => d.y0!)
      .attr('height', (d: any) => d.y1! - d.y0!)
      .attr('width', (d: any) => d.x1! - d.x0!)
      .attr('fill', 'var(--color-synthesis-blue)')
      .attr('opacity', 0.6)
      .attr('tabindex', 0)
      .on('focus', (event, d) => {
        d3.select(event.target).attr('stroke', 'black').attr('stroke-width', 2);
      })
      .on('blur', (event) => {
        d3.select(event.target).attr('stroke', null);
      })
      .on('click', async (_, d: any) => {
        const maskedEvent = await PrivacyLogger().log('sankey_interaction', {
          tenantId,
          chartId,
          node: d.name,
          action: 'click',
        });
        await supabase.from('system_metrics').insert({
          tenant_id: tenantId,
          metric: 'sankey_interaction',
          value: maskedEvent,
        });
      });

    nodesSelection.append('title').text((d: any) => `${d.name}\n${d.value}`);

    linkGroup
      .selectAll('path')
      .data(sankeyLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal() as any) // Cast to any if type issues with d3-sankey
      .attr('stroke', 'var(--color-cerebral-gray)')
      .attr('stroke-width', (d: any) => Math.max(1, d.width!))
      .attr('fill', 'none')
      .attr('opacity', 0.3)
      .append('title')
      .text((d: any) => `${d.source.name} → ${d.target.name}\n${d.value}`);

    labelGroup
      .selectAll('text')
      .data(sankeyNodes)
      .join('text')
      .attr('x', (d: any) => (d.x0! < width / 2 ? d.x1! + 6 : d.x0! - 6))
      .attr('y', (d: any) => (d.y1! + d.y0!) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => (d.x0! < width / 2 ? 'start' : 'end'))
      .text((d: any) => d.name)
      .attr('fill', 'var(--color-text-primary)')
      .attr('aria-hidden', 'true');
  }, [nodes, links, width, height, isVisible, tenantId, chartId]);

  return (
    <div ref={containerRef} data-testid={dataTestId} className={isReducedMotion ? 'reduced-motion' : ''}>
      <svg ref={svgRef} width={width} height={height} role="img" aria-label="Sankey diagram showing data flow"></svg>
    </div>
  );
};

export default SankeyDiagram;
