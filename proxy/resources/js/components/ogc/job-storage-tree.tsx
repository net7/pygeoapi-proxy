import {
    ChevronRightIcon,
    FileIcon,
    FolderIcon,
    FolderOpenIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { formatStorageBytes } from '@/lib/job-storage';
import { cn } from '@/lib/utils';
import type { JobStorageNode } from '@/types';

type TreeRow = {
    node: JobStorageNode;
    parentPath?: string;
    depth: number;
    position: number;
    siblings: number;
    guides: boolean[];
};

function visibleRows(
    nodes: JobStorageNode[],
    expanded: Set<string>,
    parent?: TreeRow,
): TreeRow[] {
    return nodes.flatMap((node, index) => {
        const row: TreeRow = {
            node,
            parentPath: parent?.node.path,
            depth: parent ? parent.depth + 1 : 0,
            position: index + 1,
            siblings: nodes.length,
            guides: parent
                ? [...parent.guides, parent.position < parent.siblings]
                : [],
        };

        return [
            row,
            ...(expanded.has(node.path)
                ? visibleRows(node.children, expanded, row)
                : []),
        ];
    });
}

export default function JobStorageTree({
    nodes,
    label,
    locale,
}: {
    nodes: JobStorageNode[];
    label: string;
    locale: string;
}) {
    const [expanded, setExpanded] = useState(
        () => new Set(nodes.map((node) => node.path)),
    );
    const [focusedPath, setFocusedPath] = useState(nodes[0]?.path);
    const tree = useRef<HTMLDivElement>(null);
    const rows = visibleRows(nodes, expanded);

    function toggle(path: string) {
        setExpanded((current) => {
            const next = new Set(current);

            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }

            return next;
        });
    }

    function focusRow(index: number) {
        tree.current
            ?.querySelectorAll<HTMLElement>('[role="treeitem"]')
            [index]?.focus();
    }

    function handleKeyDown(
        event: KeyboardEvent<HTMLDivElement>,
        row: TreeRow,
        index: number,
    ) {
        const canExpand = row.node.children.length > 0;

        switch (event.key) {
            case 'ArrowDown':
                focusRow(Math.min(index + 1, rows.length - 1));
                break;
            case 'ArrowUp':
                focusRow(Math.max(index - 1, 0));
                break;
            case 'Home':
                focusRow(0);
                break;
            case 'End':
                focusRow(rows.length - 1);
                break;
            case 'ArrowRight':
                if (canExpand) {
                    if (expanded.has(row.node.path)) {
                        focusRow(index + 1);
                    } else {
                        toggle(row.node.path);
                    }
                }

                break;
            case 'ArrowLeft':
                if (canExpand && expanded.has(row.node.path)) {
                    toggle(row.node.path);
                } else {
                    focusRow(
                        rows.findIndex(
                            (item) => item.node.path === row.parentPath,
                        ),
                    );
                }

                break;
            case 'Enter':
            case ' ':
                if (canExpand) {
                    toggle(row.node.path);
                }

                break;
            default:
                return;
        }

        event.preventDefault();
    }

    return (
        <div
            ref={tree}
            role="tree"
            aria-label={label}
            className="min-w-0 p-2 text-sm"
        >
            {rows.map((row, index) => {
                const { node, depth } = row;
                const canExpand = node.children.length > 0;
                const isExpanded = expanded.has(node.path);
                const Icon =
                    node.type === 'file'
                        ? FileIcon
                        : isExpanded && canExpand
                          ? FolderOpenIcon
                          : FolderIcon;

                return (
                    <div
                        key={node.path}
                        role="treeitem"
                        aria-label={`${node.name}, ${formatStorageBytes(node.sizeBytes, locale)}`}
                        aria-level={depth + 1}
                        aria-posinset={row.position}
                        aria-setsize={row.siblings}
                        aria-expanded={canExpand ? isExpanded : undefined}
                        tabIndex={focusedPath === node.path ? 0 : -1}
                        onFocus={() => setFocusedPath(node.path)}
                        onClick={(event) => {
                            event.currentTarget.focus();

                            if (canExpand) {
                                toggle(node.path);
                            }
                        }}
                        onKeyDown={(event) => handleKeyDown(event, row, index)}
                        className={cn(
                            'relative flex min-h-9 items-center gap-2 rounded-md pr-2 outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50',
                            canExpand && 'cursor-pointer',
                        )}
                        style={{ paddingLeft: depth * 20 + 4 }}
                    >
                        {row.guides.map((continues, level) =>
                            continues && level < depth - 1 ? (
                                <span
                                    key={level}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 border-l border-border"
                                    style={{ left: level * 20 + 12 }}
                                />
                            ) : null,
                        )}
                        {depth > 0 ? (
                            <>
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-0 h-1/2 w-3 rounded-bl-md border-b border-l border-border"
                                    style={{ left: (depth - 1) * 20 + 12 }}
                                />
                                {row.position < row.siblings ? (
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute top-1/2 bottom-0 border-l border-border"
                                        style={{ left: (depth - 1) * 20 + 12 }}
                                    />
                                ) : null}
                            </>
                        ) : null}
                        <span className="flex size-4 shrink-0 items-center justify-center">
                            {canExpand ? (
                                <ChevronRightIcon
                                    aria-hidden="true"
                                    className={cn(
                                        'size-3.5 text-muted-foreground transition-transform motion-reduce:transition-none',
                                        isExpanded && 'rotate-90',
                                    )}
                                />
                            ) : null}
                        </span>
                        <Icon
                            aria-hidden="true"
                            className={cn(
                                'size-4 shrink-0',
                                node.type === 'directory'
                                    ? 'text-primary'
                                    : 'text-muted-foreground',
                            )}
                        />
                        <span
                            className="min-w-0 flex-1 truncate"
                            title={node.path}
                        >
                            {node.name}
                        </span>
                        <span
                            className="shrink-0 text-xs text-muted-foreground tabular-nums"
                            title={`${node.sizeBytes.toLocaleString(locale)} B`}
                        >
                            {formatStorageBytes(node.sizeBytes, locale)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
