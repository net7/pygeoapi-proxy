import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    BoldIcon,
    Code2Icon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    QuoteIcon,
    Redo2Icon,
    Undo2Icon,
} from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import type { TiptapDocument } from '@/types';

const emptyDocument: TiptapDocument = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
        },
    ],
};

const noteExtensions = [
    StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: false,
    }),
    Link.configure({
        autolink: false,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
        },
    }),
];

export function JobNoteEditor({
    value,
    onChange,
    readOnly = false,
    autoFocus = false,
    className,
}: {
    value?: TiptapDocument | null;
    onChange?: (note: TiptapDocument) => void;
    readOnly?: boolean;
    autoFocus?: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const editor = useEditor({
        extensions: noteExtensions,
        content: (value ?? emptyDocument) as JSONContent,
        editable: !readOnly,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: cn(
                    'prose-note min-h-36 max-w-none rounded-md border bg-background px-3 py-2 text-sm ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    readOnly &&
                        'min-h-0 border-0 px-0 py-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                ),
            },
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getJSON() as TiptapDocument);
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        const nextValue = value ?? emptyDocument;

        if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nextValue)) {
            editor.commands.setContent(nextValue as JSONContent, {
                emitUpdate: false,
            });
        }
    }, [editor, value]);

    useEffect(() => {
        if (!editor || readOnly || !autoFocus) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            editor.commands.focus('end');
        });

        return () => window.cancelAnimationFrame(frame);
    }, [autoFocus, editor, readOnly]);

    if (!editor) {
        return null;
    }

    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            {!readOnly ? (
                <TooltipProvider>
                    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                        <ToolbarButton
                            label={t('jobs.noteToolbar.undo')}
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={
                                !editor.can().chain().focus().undo().run()
                            }
                        >
                            <Undo2Icon />
                        </ToolbarButton>
                        <ToolbarButton
                            label={t('jobs.noteToolbar.redo')}
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={
                                !editor.can().chain().focus().redo().run()
                            }
                        >
                            <Redo2Icon />
                        </ToolbarButton>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.bold')}
                            pressed={editor.isActive('bold')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleBold().run()
                            }
                        >
                            <BoldIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.italic')}
                            pressed={editor.isActive('italic')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleItalic().run()
                            }
                        >
                            <ItalicIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.bulletList')}
                            pressed={editor.isActive('bulletList')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleBulletList().run()
                            }
                        >
                            <ListIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.orderedList')}
                            pressed={editor.isActive('orderedList')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleOrderedList().run()
                            }
                        >
                            <ListOrderedIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.blockquote')}
                            pressed={editor.isActive('blockquote')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleBlockquote().run()
                            }
                        >
                            <QuoteIcon />
                        </ToolbarToggle>
                        <ToolbarToggle
                            label={t('jobs.noteToolbar.codeBlock')}
                            pressed={editor.isActive('codeBlock')}
                            onPressedChange={() =>
                                editor.chain().focus().toggleCodeBlock().run()
                            }
                        >
                            <Code2Icon />
                        </ToolbarToggle>
                        <ToolbarButton
                            label={t('jobs.noteToolbar.link')}
                            onClick={() => {
                                const currentHref =
                                    editor.getAttributes('link').href ?? '';
                                const href = window.prompt(
                                    t('jobs.noteLinkPrompt'),
                                    currentHref,
                                );

                                if (href === null) {
                                    return;
                                }

                                if (href.trim() === '') {
                                    editor.chain().focus().unsetLink().run();

                                    return;
                                }

                                editor
                                    .chain()
                                    .focus()
                                    .extendMarkRange('link')
                                    .setLink({ href: href.trim() })
                                    .run();
                            }}
                        >
                            <LinkIcon />
                        </ToolbarButton>
                    </div>
                </TooltipProvider>
            ) : null}

            <EditorContent editor={editor} />
        </div>
    );
}

function ToolbarButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    disabled={disabled}
                    onClick={onClick}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function ToolbarToggle({
    label,
    pressed,
    onPressedChange,
    children,
}: {
    label: string;
    pressed: boolean;
    onPressedChange: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Toggle
                    size="sm"
                    pressed={pressed}
                    aria-label={label}
                    onPressedChange={onPressedChange}
                >
                    {children}
                </Toggle>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
