"use client";

import { useState, useMemo, useCallback } from "react";
import { SUNO_TAGS, CATEGORY_LABELS, CATEGORY_COLORS, type TagCategory, type SunoTag } from "@/data/suno-tags";

type TagLibraryProps = {
  isOpen: boolean;
  onToggle: () => void;
  onDragStart: (event: React.DragEvent, tag: SunoTag) => void;
  onDragEnd: (event: React.DragEvent) => void;
};

export function TagLibrary({ isOpen, onToggle, onDragStart, onDragEnd }: TagLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<TagCategory>>(
    new Set(["structure", "vocal-styles", "mood"])
  );

  const toggleCategory = useCallback((category: TagCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(
      new Set([
        "structure",
        "vocal-styles",
        "vocal-effects",
        "instrumental",
        "strings",
        "keys-synths",
        "percussion",
        "brass-woodwinds",
        "world-ethnic",
        "mood",
        "energy",
        "production",
        "tempo",
        "sound-effects",
        "human-sounds",
      ])
    );
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  // Group tags by category
  const tagsByCategory = useMemo(() => {
    const filtered = searchQuery.trim()
      ? SUNO_TAGS.filter((tag) =>
          tag.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : SUNO_TAGS;

    const grouped = new Map<TagCategory, SunoTag[]>();
    filtered.forEach((tag) => {
      if (!grouped.has(tag.category)) {
        grouped.set(tag.category, []);
      }
      grouped.get(tag.category)!.push(tag);
    });

    return grouped;
  }, [searchQuery]);

  // Sort categories
  const sortedCategories = useMemo(() => {
    return Array.from(tagsByCategory.keys()).sort((a, b) => {
      const orderA = Object.keys(CATEGORY_LABELS).indexOf(a);
      const orderB = Object.keys(CATEGORY_LABELS).indexOf(b);
      return orderA - orderB;
    });
  }, [tagsByCategory]);

  if (!isOpen) {
    return (
      <div className="tag-library-collapsed">
        <button
          type="button"
          className="tag-library-toggle-button"
          onClick={onToggle}
          aria-label="Open tag library"
          title="Open Suno AI Tag Library"
        >
          <span className="tag-library-toggle-icon">🏷️</span>
          <span className="tag-library-toggle-label">Tags</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="tag-library" aria-label="Suno AI Tag Library">
      <div className="tag-library-header">
        <div className="tag-library-title-row">
          <h2>Suno AI Tags</h2>
          <button
            type="button"
            className="tag-library-close-button"
            onClick={onToggle}
            aria-label="Close tag library"
          >
            ✕
          </button>
        </div>
        <p className="tag-library-subtitle">
          Drag tags onto the canvas to add them to your lyrics
        </p>
        <div className="tag-library-search">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tag-library-search-input"
          />
        </div>
        <div className="tag-library-controls">
          <button
            type="button"
            className="tag-library-control-button"
            onClick={expandAll}
          >
            Expand All
          </button>
          <button
            type="button"
            className="tag-library-control-button"
            onClick={collapseAll}
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="tag-library-content">
        {sortedCategories.length === 0 ? (
          <p className="tag-library-empty">No tags match your search.</p>
        ) : (
          sortedCategories.map((category) => {
            const tags = tagsByCategory.get(category) || [];
            const isExpanded = expandedCategories.has(category);
            const categoryColor = CATEGORY_COLORS[category];

            return (
              <div key={category} className="tag-category">
                <button
                  type="button"
                  className="tag-category-header"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isExpanded}
                >
                  <span
                    className="tag-category-icon"
                    style={{ color: categoryColor }}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className="tag-category-title">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="tag-category-count">({tags.length})</span>
                </button>

                {isExpanded && (
                  <div className="tag-category-content">
                    <div className="tag-grid">
                      {tags.map((tag, index) => (
                        <div
                          key={`${category}-${tag.label}-${index}`}
                          className="tag-chip"
                          draggable
                          onDragStart={(e) => onDragStart(e, tag)}
                          onDragEnd={onDragEnd}
                          style={{
                            borderColor: categoryColor,
                            backgroundColor: `${categoryColor}15`,
                          }}
                          title={tag.description || tag.label}
                        >
                          <span className="tag-chip-text">
                            {tag.format === "bracket"
                              ? `[${tag.label}]`
                              : `*${tag.label}*`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="tag-library-footer">
        <p className="tag-library-hint">
          💡 Tip: Tags in <strong>[ ]</strong> are for structure/instruments.
          Tags in <strong>* *</strong> are for sound effects.
        </p>
      </div>
    </aside>
  );
}
