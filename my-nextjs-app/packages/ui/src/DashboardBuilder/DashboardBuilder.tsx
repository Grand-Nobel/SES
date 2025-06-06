// packages/ui/src/DashboardBuilder/DashboardBuilder.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
// KpiCard, Button, Modal are now imported individually or from a central UI export
import KpiCard from '../KpiCard/KpiCard'; // Assuming KpiCard is default export
import Button from '../Button/Button'; // Assuming Button is default export
import { Modal } from '../Modal/Modal'; // Assuming Modal is named export
import { ScreenReaderAnnouncer } from '../ScreenReaderAnnouncer/ScreenReaderAnnouncer';
import { Input } from '../Input/Input'; // Assuming Input component exists and is default export
import { Card } from '../Card/Card'; // Import the new Card component
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import debounce from 'lodash/debounce'; // Ensure lodash and types are installed
import './DashboardBuilder.module.css';
import { OfflineMutationManager } from '@/lib/api/offlineMutationManager'; // Added for consistency if still used

export interface Widget { // Added export keyword
  id: string;
  type: 'kpi' | 'chart' | 'task-list';
  x: number;
  y: number;
  w: number;
  h: number;
  config: {
    title: string;
    value?: number;
    trend?: 'up' | 'down';
    icon?: React.ReactElement<{ size?: number }>;
    chartType?: string;
  };
}

interface Annotation {
  id: string;
  widgetId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface DashboardBuilderProps {
  initialLayout?: Widget[]; // Made optional as per collaborative version
  initialAnnotations?: Annotation[];
  'data-testid'?: string;
}

const offlineManager = OfflineMutationManager.getInstance(); // If still needed for non-collaborative parts

const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  initialLayout = [],
  initialAnnotations = [],
  'data-testid': dataTestId = 'dashboard-builder',
}) => {
  const { t } = useTranslation('dashboard');
  const { tenantId, user } = useAuthStore();
  const announcer = ScreenReaderAnnouncer.getInstance();
  
  const [layout, setLayout] = useState<Widget[]>(initialLayout);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [isAddAnnotationOpen, setIsAddAnnotationOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [annotationContent, setAnnotationContent] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Check permissions
  useEffect(() => {
    async function checkPermissions() {
      if (!tenantId || !user) {
        setCanEdit(false);
        return;
      }
      const { data } = await supabase
        .from('dashboard_configs')
        .select('locked_by')
        .eq('tenant_id', tenantId)
        .single();
      const isAdmin = user?.role === 'admin'; // Assuming role is now on user object
      const isLocked = data?.locked_by && data.locked_by !== user?.id;
      setCanEdit(isAdmin || !isLocked);
    }
    checkPermissions();
    setIsReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [tenantId, user]);

  // Yjs setup for real-time collaboration
  useEffect(() => {
    if (!tenantId || !user) return;

    const doc = new Y.Doc();
    // Ensure signaling server URL is configurable or correct
    const provider = new WebrtcProvider(`dashboard-${tenantId}`, doc, { signaling: ['wss://signaling.ses.com'] }); 
    const yLayout = doc.getArray<Widget>('layout');
    const yAnnotations = doc.getArray<Annotation>('annotations');

    const layoutObserver = () => {
      setLayout(yLayout.toArray());
      announcer.announce(t('aria.layout_updated'), tenantId, false); // Pass tenantId
    };
    const annotationsObserver = () => {
      const newAnnotations = yAnnotations.toArray();
      setAnnotations(newAnnotations);
      debouncedSaveAnnotations(newAnnotations); // Save to Supabase, debounced
      announcer.announce(t('aria.annotation_updated'), tenantId, true); // Pass tenantId
      notifyCollaborators(); // Notify other users
    };

    yLayout.observe(layoutObserver);
    yAnnotations.observe(annotationsObserver);

    // Initialize Yjs document with initial data if not already populated
    // This logic might need refinement to handle merging initial props with Yjs state
    if (yLayout.length === 0 && initialLayout.length > 0) {
        yLayout.push(initialLayout);
    } else if (yLayout.length > 0) {
        setLayout(yLayout.toArray()); // Sync local state if Yjs already has data
    }

    if (yAnnotations.length === 0 && initialAnnotations.length > 0) {
        yAnnotations.push(initialAnnotations);
    } else if (yAnnotations.length > 0) {
        setAnnotations(yAnnotations.toArray());
    }
    
    setYDoc(doc);

    return () => {
      provider.disconnect();
      doc.destroy();
      yLayout.unobserve(layoutObserver);
      yAnnotations.unobserve(annotationsObserver);
    };
  }, [tenantId, user]); // Removed initialLayout, initialAnnotations from deps to avoid re-init on prop change after Yjs setup

  const debouncedSaveAnnotations = useCallback(
    debounce(async (newAnnotations: Annotation[]) => {
      if (!tenantId || !user) return;
      const batch = newAnnotations.map((annotation) => ({
        tenant_id: tenantId,
        widget_id: annotation.widgetId,
        content: annotation.content,
        created_by: annotation.createdBy,
        created_at: annotation.createdAt,
        id: annotation.id, // Ensure ID is included for upsert
      }));
      // Use upsert to handle new and existing annotations
      await supabase.from('dashboard_annotations').upsert(batch, { onConflict: 'id' }); 
      
      const maskedEvent = await PrivacyLogger().log('collaboration_event', {
        tenantId,
        userId: user?.id,
        action: 'update_annotations',
        // annotations: newAnnotations, // Potentially large, consider logging count or summary
      });
      await supabase.from('system_metrics').insert({
        tenant_id: tenantId,
        metric: 'collaboration_event',
        value: maskedEvent,
      });
    }, 1000),
    [tenantId, user] 
  );

  const handleLayoutChange = async (newGridLayout: Layout[]) => {
    if (!yDoc || !canEdit) return;
    const yLayout = yDoc.getArray<Widget>('layout');
    const updatedLayout = layout.map((widget) => {
      const newItem = newGridLayout.find((item) => item.i === widget.id);
      if (newItem) {
        return { ...widget, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h };
      }
      return widget;
    });
    
    // Yjs transaction to update layout
    yDoc.transact(() => {
        yLayout.delete(0, yLayout.length); // Clear existing
        yLayout.push(updatedLayout);      // Push new layout
    });
    // Persist to Supabase (this might be redundant if Yjs handles persistence via a backend connector)
    // The original outline had a direct Supabase call here. If Yjs is the source of truth,
    // this direct call might conflict or be unnecessary if a Yjs backend connector is used.
    // For now, keeping it as per the outline's apparent intent.
    await supabase.from('dashboard_configs').upsert({ tenant_id: tenantId, layout: updatedLayout });
  };

  const handleAddWidget = async (type: Widget['type']) => {
    if (!yDoc || !canEdit) return;
    const yLayout = yDoc.getArray<Widget>('layout');
    const newWidget: Widget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      x: 0,
      y: Infinity, 
      w: 2,
      h: 2,
      config: { title: `${type.charAt(0).toUpperCase() + type.slice(1)} Widget` },
    };
    yLayout.push([newWidget]); // Add to Yjs array
    // Persist to Supabase (similar consideration as handleLayoutChange)
    await supabase.from('dashboard_configs').upsert({ tenant_id: tenantId, layout: yLayout.toArray() });
    setIsAddWidgetOpen(false);
    announcer.announce(t('aria.widget_added', { type }), tenantId, false); // Pass tenantId
  };

  const handleAddAnnotation = async () => {
    if (!selectedWidgetId || !yDoc || !user || !canEdit) return;
    const yAnnotations = yDoc.getArray<Annotation>('annotations');
    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      widgetId: selectedWidgetId,
      content: annotationContent,
      createdBy: user.id || 'unknown', // Ensure user.id is available
      createdAt: new Date().toISOString(),
    };
    yAnnotations.push([newAnnotation]);
    setAnnotationContent('');
    setIsAddAnnotationOpen(false);
    setSelectedWidgetId(null);
  };

  const notifyCollaborators = async () => {
    if (!tenantId || !user) return;
    // This is a client-side notification, consider server-side for reliability
    const { data: collaborators } = await supabase
      .from('dashboard_collaborators') // Assuming this table exists
      .select('user_id')
      .eq('tenant_id', tenantId);
      
    for (const collaborator of collaborators || []) {
      if (collaborator.user_id === user.id) continue;
      // This fetch should target an internal API route that handles sending notifications
      try {
        await fetch('/api/notifications/send', { // Ensure this API route exists
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: collaborator.user_id,
            message: t('notification.annotation_added', { userName: user.id }), // Personalize if user name available
            dashboardId: tenantId, // Example: link to dashboard
          }),
        });
      } catch (error) {
        console.error("Failed to send notification:", error);
      }
    }
  };

  const handleWidgetKeyDown = (e: React.KeyboardEvent, widgetId: string) => {
    if (e.ctrlKey && e.key === 'e') { // Example: Ctrl+E to edit/annotate
      setSelectedWidgetId(widgetId);
      setIsAddAnnotationOpen(true);
      announcer.announce(t('aria.add_annotation_opened'), tenantId, false); // Pass tenantId
    }
  };
  
  const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      if (canEdit) setIsAddWidgetOpen(true);
    }
  };


  return (
    <div onKeyDown={handleGlobalKeyDown} data-testid={dataTestId} style={{ '--use-transforms': !isReducedMotion } as React.CSSProperties}>
      {canEdit && (
        <Button onClick={() => setIsEditing(!isEditing)} data-testid={`${dataTestId}-toggle-edit`}>
          {isEditing ? t('save_layout') : t('edit_layout')}
        </Button>
      )}
      {canEdit && (
        <Button onClick={() => setIsAddWidgetOpen(true)} data-testid={`${dataTestId}-add-widget`}>
          {t('add_widget')}
        </Button>
      )}
      <GridLayout
        className="layout"
        layout={layout.map((widget) => ({ i: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h }))}
        cols={12}
        rowHeight={100}
        width={1200}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditing && canEdit}
        isResizable={isEditing && canEdit}
        draggableHandle=".widget-handle"
        draggableCancel=".widget-content"
        useCSSTransforms={!isReducedMotion}
      >
        {layout.map((widget) => (
          <div key={widget.id} data-grid={{ x: widget.x, y: widget.y, w: widget.w, h: widget.h }} onKeyDown={(e) => handleWidgetKeyDown(e, widget.id)} tabIndex={0}>
            {isEditing && canEdit && (
              <div className="widget-handle" aria-label={`Drag handle for ${widget.config.title}`}>Drag</div>
            )}
            <div className="widget-content">
              {widget.type === 'kpi' && (
                <Card className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-4">
                  <KpiCard title={widget.config.title} value={widget.config.value || 0} trend={widget.config.trend || 'up'} />
                </Card>
              )}
              {/* Render other widget types here */}
            </div>
            {annotations
              .filter((a) => a.widgetId === widget.id)
              .map((annotation) => (
                <div key={annotation.id} className="annotation" role="note">
                  <p>{annotation.content}</p>
                  <small>{t('created_by', { user: annotation.createdBy, date: new Date(annotation.createdAt).toLocaleString() })}</small>
                </div>
              ))}
            {canEdit && (
              <Button onClick={() => { setSelectedWidgetId(widget.id); setIsAddAnnotationOpen(true); }} data-testid={`${dataTestId}-add-annotation-${widget.id}`}>
                Add Annotation
              </Button>
            )}
            {isEditing && canEdit && (
              <Button
                onClick={async () => {
                  if (!yDoc) return;
                  const yLayout = yDoc.getArray<Widget>('layout');
                  const currentLayout = yLayout.toArray();
                  const updatedLayout = currentLayout.filter((w) => w.id !== widget.id);
                  yDoc.transact(() => {
                    yLayout.delete(0, yLayout.length);
                    yLayout.push(updatedLayout);
                  });
                  await supabase.from('dashboard_configs').upsert({ tenant_id: tenantId, layout: updatedLayout });
                  announcer.announce(t('aria.widget_removed', { type: widget.type }), tenantId, false); // Pass tenantId
                }}
                aria-label={t('aria.remove_widget', { type: widget.type })}
                data-testid={`${dataTestId}-remove-widget-${widget.id}`}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </GridLayout>
      
      <Modal
        isOpen={isAddWidgetOpen}
        onClose={() => setIsAddWidgetOpen(false)}
        title={t('add_widget_title')}
        data-testid={`${dataTestId}-add-widget-modal`}
      >
        <Button onClick={() => handleAddWidget('kpi')} data-testid={`${dataTestId}-add-kpi`}>Add KPI Widget</Button>
        <Button onClick={() => handleAddWidget('chart')} data-testid={`${dataTestId}-add-chart`}>Add Chart Widget</Button>
        <Button onClick={() => handleAddWidget('task-list')} data-testid={`${dataTestId}-add-task-list`}>Add Task List Widget</Button>
      </Modal>

      <Modal
        isOpen={isAddAnnotationOpen}
        onClose={() => { setIsAddAnnotationOpen(false); setAnnotationContent(''); setSelectedWidgetId(null); }}
        title={t('add_annotation_title')}
        data-testid={`${dataTestId}-add-annotation-modal`}
      >
        <Input
          value={annotationContent}
          onChange={(e) => setAnnotationContent(e.target.value)}
          placeholder={t('annotation_placeholder')}
          data-testid={`${dataTestId}-annotation-input`}
          aria-label={t('aria.annotation_input')}
        />
        <Button onClick={handleAddAnnotation} data-testid={`${dataTestId}-submit-annotation`}>Add Annotation</Button>
      </Modal>
    </div>
  );
};

export default DashboardBuilder;
