<?php

test('process form keeps inputs beside output submission on desktop without execution mode controls', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($source)
        ->toContain('lg:grid-cols-[minmax(0,1fr)_22rem]')
        ->toContain('lg:sticky')
        ->toContain('@/routes/processes/jobs')
        ->toContain('ogc.outputs')
        ->not->toContain('ogc.execution')
        ->not->toContain('ToggleGroup')
        ->not->toContain('ToggleGroupItem')
        ->not->toContain('sync-execute');
});

test('process index cards are optimized for scanning', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/processes/index.tsx');

    expect($source)
        ->toContain('CardFooter')
        ->toContain('md:grid-cols-2 2xl:grid-cols-4')
        ->toContain('h-full overflow-hidden')
        ->toContain('group-hover:border-primary/40')
        ->toContain('min-h-[3.75rem]')
        ->toContain('ogc.noDescription')
        ->toContain('processes.length')
        ->toContain('process.version')
        ->toContain('ogc.openProcess')
        ->toContain('ArrowRightIcon')
        ->toContain('data-icon="inline-end"')
        ->not->toContain('process.jobControlOptions')
        ->not->toContain('process.outputTransmission')
        ->not->toContain('ogc.jobControls')
        ->not->toContain('ogc.outputModes')
        ->not->toContain('ProcessMetadataSection')
        ->not->toContain('<Card key={process.id}>');
});

test('process form exposes a local development prefill action', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($source)
        ->toContain('examplePayload')
        ->toContain('ogc.prefillTestData')
        ->toContain('bg-amber-100')
        ->toContain('applyExamplePayload')
        ->toContain('WandSparklesIcon')
        ->toContain('data-icon="inline-start"');
});

test('decimal process number inputs are valid after prefill', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/schema-field-renderer.tsx');

    expect($source)
        ->toContain("step={field.type === 'number' ? 'any' : undefined}");
});

test('array table fields keep a practical responsive width', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/array-table-field.tsx');

    expect($source)
        ->toContain('tableMinWidth')
        ->toContain('overflow-x-auto rounded-md border')
        ->not->toContain('min-w-[960px]');
});

test('text buttons include representative icons', function () {
    $requirements = [
        'resources/js/pages/process-executions/index.tsx' => ['jobs.details' => 'ListChecksIcon'],
        'resources/js/pages/auth/login.tsx' => ['auth.login.submit' => 'LogInIcon'],
        'resources/js/pages/auth/register.tsx' => ['auth.createAccount' => 'UserPlusIcon'],
        'resources/js/pages/auth/forgot-password.tsx' => ['auth.forgotPassword.submit' => 'MailIcon'],
        'resources/js/pages/auth/reset-password.tsx' => ['auth.resetPassword.submit' => 'KeyRoundIcon'],
        'resources/js/pages/auth/confirm-password.tsx' => ['auth.confirmPassword.submit' => 'ShieldCheckIcon'],
        'resources/js/pages/settings/profile.tsx' => ['common.save' => 'SaveIcon'],
        'resources/js/pages/settings/security.tsx' => ['common.save' => 'ShieldCheckIcon'],
        'resources/js/components/delete-user.tsx' => [
            'common.cancel' => 'XIcon',
            'settings.deleteAccount.title' => 'Trash2Icon',
            'settings.deleteAccount.sendCode' => 'MailCheckIcon',
        ],
        'resources/js/components/passkey-register.tsx' => [
            'settings.passkeys.add' => 'KeyRoundIcon',
            'settings.passkeys.register' => 'KeyRoundIcon',
            'common.cancel' => 'XIcon',
        ],
        'resources/js/components/passkey-item.tsx' => [
            'common.cancel' => 'XIcon',
            'settings.passkeys.remove' => 'Trash2',
        ],
        'resources/js/components/ogc/dynamic-process-form.tsx' => ['ogc.execute' => 'PlayIcon'],
    ];

    foreach ($requirements as $path => $expectedIcons) {
        $source = file_get_contents(getcwd().'/'.$path);

        foreach ($expectedIcons as $buttonLabel => $iconName) {
            expect($source)
                ->toContain($buttonLabel)
                ->toContain($iconName)
                ->toContain('data-icon=');
        }
    }
});

test('interactive button and link surfaces use pointer cursors', function () {
    $requirements = [
        'resources/js/components/ui/button.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/toggle.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/checkbox.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/select.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/sidebar.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/navigation-menu.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/dropdown-menu.tsx' => [
            'cursor-pointer',
            'data-[disabled]:cursor-not-allowed',
        ],
        'resources/js/components/ui/dialog.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/sheet.tsx' => [
            'cursor-pointer',
            'disabled:cursor-not-allowed',
        ],
        'resources/js/components/ui/breadcrumb.tsx' => [
            'cursor-pointer',
        ],
        'resources/js/components/text-link.tsx' => [
            'cursor-pointer',
        ],
        'resources/js/components/password-input.tsx' => [
            'cursor-pointer',
        ],
        'resources/js/components/appearance-tabs.tsx' => [
            'cursor-pointer',
        ],
        'resources/js/components/language-tabs.tsx' => [
            'cursor-pointer',
            'LanguagesIcon',
            'languageMetadata',
            'updateLanguage',
        ],
    ];

    foreach ($requirements as $path => $expectedClasses) {
        $source = file_get_contents(getcwd().'/'.$path);

        foreach ($expectedClasses as $expectedClass) {
            expect($source)->toContain($expectedClass);
        }
    }
});

test('jobs index exposes a filterable status table', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $normalizedSource = preg_replace('/\s+/', '', $source) ?? '';
    $helperSource = file_get_contents(getcwd().'/resources/js/lib/jobs.ts');
    $copyableJobIdSource = file_get_contents(getcwd().'/resources/js/components/ogc/copyable-job-id.tsx');

    expect($source)
        ->toContain('jobs.title')
        ->toContain('@/routes/jobs')
        ->toContain('@tanstack/react-table')
        ->toContain('ColumnDef')
        ->toContain('SortingState')
        ->toContain('ColumnFiltersState')
        ->toContain('VisibilityState')
        ->toContain('flexRender')
        ->toContain('getCoreRowModel')
        ->toContain('getFilteredRowModel')
        ->toContain('getPaginationRowModel')
        ->toContain('getSortedRowModel')
        ->toContain('useReactTable')
        ->toContain('onClick={() =>')
        ->toContain('cursor-pointer')
        ->toContain('ToggleGroup')
        ->toContain('ToggleGroupItem')
        ->toContain('DropdownMenuCheckboxItem')
        ->toContain('SelectItem')
        ->toContain('SearchIcon')
        ->toContain('sm:w-[34rem]')
        ->toContain('xl:w-[42rem]')
        ->toContain('jobs.searchPlaceholder')
        ->toContain('ArrowUpDownIcon')
        ->toContain('statusOptions')
        ->toContain('columnFilters')
        ->toContain('columnVisibility')
        ->toContain('submittedAt: false')
        ->toContain('finishedAt: false')
        ->toContain('pagination')
        ->toContain('getColumn(\'jobSearch\')')
        ->toContain('getColumn(\'status\')')
        ->toContain('setFilterValue')
        ->toContain('getAllColumns()')
        ->toContain('table.getHeaderGroups()')
        ->toContain('table.getRowModel().rows')
        ->toContain('table.previousPage()')
        ->toContain('table.nextPage()')
        ->toContain('table.setPageSize')
        ->toContain('SortableHeader')
        ->toContain('jobStatusStyles')
        ->toContain('TableHeader')
        ->toContain('TableBody')
        ->toContain('TableRow')
        ->toContain('TableHead')
        ->toContain('TableCell')
        ->toContain('colSpan={columns.length}')
        ->toContain('formatJobDate')
        ->toContain('createdAt')
        ->toContain('remoteJobId')
        ->toContain("remoteJobId: 'whitespace-nowrap'")
        ->toContain('@/components/ogc/copyable-job-id')
        ->toContain('CopyableJobId')
        ->toContain('<CopyableJobId displayJobId={displayJobId} />')
        ->toContain('whitespace-nowrap')
        ->toContain('styles.rowClassName')
        ->toContain('@/components/ogc/delete-job-dialog')
        ->toContain('DeleteJobButton')
        ->toContain("actions: 'w-24 text-right'")
        ->toContain('submittedAt')
        ->toContain('completedAt')
        ->toContain('failedAt')
        ->toContain('Badge')
        ->toContain('asChild')
        ->toContain('variant="default"')
        ->toContain('size="icon"')
        ->toContain('aria-label={t(\'jobs.details\')}')
        ->toContain('title={t(\'jobs.details\')}')
        ->toContain('<span className="sr-only">{t(\'jobs.details\')}</span>')
        ->toContain('redirectBack')
        ->toContain('showLabel={false}')
        ->not->toContain('max-w-52 truncate')
        ->not->toContain("remoteJobId: 'w-[300px] max-w-[300px]'")
        ->not->toContain('max-w-[300px]')
        ->not->toContain('border-l-4 align-top')
        ->not->toContain('import { Checkbox }')
        ->not->toContain('RowSelectionState')
        ->not->toContain('rowSelection')
        ->not->toContain('getFilteredSelectedRowModel')
        ->not->toContain('getIsSelected')
        ->not->toContain('toggleAllPageRowsSelected')
        ->not->toContain('Select all jobs')
        ->not->toContain('Select job')
        ->not->toContain('sticky right-0')
        ->not->toContain('bg-inherit')
        ->not->toContain('filteredExecutions')
        ->not->toContain('function JobRow(')
        ->not->toContain('ExecutionCard')
        ->not->toContain('<Card');

    expect($copyableJobIdSource)
        ->toContain("import { toast } from 'sonner';")
        ->toContain('@/hooks/use-clipboard')
        ->toContain('CopyIcon')
        ->toContain('TooltipContent')
        ->toContain('jobs.jobIdCopyLabel')
        ->toContain('jobs.jobIdCopyTooltip')
        ->toContain('side="right"')
        ->toContain('align="center"')
        ->toContain('jobs.jobIdCopied')
        ->toContain('copy(displayJobId)')
        ->toContain('cursor-pointer justify-start')
        ->toContain('font-mono')
        ->toContain('event.stopPropagation()')
        ->not->toContain('side="top" align="start"');

    expect($normalizedSource)
        ->toContain('router.visit(show(row.original.id),)');

    expect($helperSource)
        ->toContain('SUBMISSION FAILED')
        ->toContain('REMOTE MISSING')
        ->toContain('rowClassName')
        ->toContain('jobStatusSortIndex')
        ->toContain('locale?: Intl.LocalesArgument')
        ->toContain('browserDateLocale()')
        ->toContain('navigator.languages')
        ->toContain('new Intl.DateTimeFormat(locale ?? browserDateLocale()');
});

test('job tables show contextual empty states', function () {
    $jobsIndexSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $adminJobsIndexSource = file_get_contents(getcwd().'/resources/js/pages/admin/jobs/index.tsx');
    $messagesSource = file_get_contents(getcwd().'/resources/js/lib/i18n/messages.ts');

    expect($jobsIndexSource)
        ->toContain("import { index as processesIndex } from '@/routes/processes'")
        ->toContain('href={processesIndex()}')
        ->toContain("t('jobs.noJobsStarted')")
        ->toContain("'jobs.startProcess'")
        ->toContain('hasActiveFilters ?')
        ->toContain("t('jobs.noJobsMatch')");

    expect($adminJobsIndexSource)
        ->toContain("t('admin.noUserJobsStarted')")
        ->toContain('hasActiveFilters ?')
        ->toContain("t('jobs.noJobsMatch')")
        ->not->toContain("t('jobs.startProcess')")
        ->not->toContain('processesIndex');

    expect($messagesSource)
        ->toContain("noJobsStarted: 'Non hai ancora avviato lavori.'")
        ->toContain("startProcess: 'Avvia un processo'")
        ->toContain("noUserJobsStarted: 'Nessun lavoro avviato dagli utenti.'")
        ->toContain("noJobsStarted: 'You have not started any jobs yet.'")
        ->toContain("startProcess: 'Start a process'")
        ->toContain("noUserJobsStarted: 'No jobs have been started by users.'");
});

test('clipboard hook falls back when async clipboard is unavailable', function () {
    $source = file_get_contents(getcwd().'/resources/js/hooks/use-clipboard.ts');

    expect($source)
        ->toContain('writeClipboardFallback')
        ->toContain("document.execCommand('copy')")
        ->toContain('textarea.select()')
        ->toContain('document.body.appendChild(textarea)')
        ->toContain('document.body.removeChild(textarea)');
});

test('remove and delete buttons use destructive styling', function () {
    foreach ([
        'resources/js/components/ogc/array-table-field.tsx',
        'resources/js/components/ogc/array-object-field.tsx',
    ] as $path) {
        expect(file_get_contents(getcwd().'/'.$path))
            ->toContain('ogc.removeRow')
            ->toContain('variant="destructive"');
    }

    expect(file_get_contents(getcwd().'/resources/js/components/passkey-item.tsx'))
        ->toContain('variant="destructive"')
        ->toContain('data-icon="icon"')
        ->not->toContain('className="text-destructive hover:bg-destructive/10 hover:text-destructive"')
        ->not->toContain('<Trash2 className=');
});

test('job detail prioritizes results and keeps request data beside them', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');

    expect($source)
        ->toContain('xl:grid-cols-[minmax(0,1fr)_24rem]')
        ->toContain('@/components/ogc/copyable-job-id')
        ->toContain('@/routes/jobs')
        ->toContain('jobStatusStyles')
        ->toContain('jobs.jobId')
        ->toContain('remoteJobId')
        ->toContain('<CopyableJobId displayJobId={displayJobId} />')
        ->toContain('common.status')
        ->toContain('jobs.requestedOutputs')
        ->toContain('jobs.results')
        ->toContain('jobs.request')
        ->toContain('className="flex justify-end"')
        ->toContain('DeleteJobButton')
        ->toContain('className="w-full sm:w-auto"')
        ->not->toContain('<code className="min-w-0 truncate');
});

test('job note editor appears on create and detail screens', function () {
    $formSource = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');
    $editorPath = getcwd().'/resources/js/components/ogc/job-note-editor.tsx';
    $cardPath = getcwd().'/resources/js/components/ogc/job-note-card.tsx';

    expect($formSource)
        ->toContain('@/components/ogc/job-note-editor')
        ->toContain('note: null')
        ->toContain("setData('note', note)");

    expect($showSource)
        ->toContain('@/components/ogc/job-note-card')
        ->toContain('<JobNoteCard execution={execution} />');

    expect($editorPath)->toBeFile()
        ->and($cardPath)->toBeFile();

    $editorSource = file_get_contents($editorPath);
    $cardSource = file_get_contents($cardPath);

    expect($editorSource)
        ->toContain('@tiptap/react')
        ->toContain('@tiptap/starter-kit')
        ->toContain('@tiptap/extension-link')
        ->toContain('BoldIcon')
        ->toContain('ItalicIcon')
        ->toContain('ListIcon')
        ->toContain('ListOrderedIcon')
        ->toContain('QuoteIcon')
        ->toContain('LinkIcon')
        ->toContain('Undo2Icon')
        ->toContain('Redo2Icon');

    expect($cardSource)
        ->toContain('@/routes/jobs/note')
        ->toContain('DialogTitle')
        ->toContain("t('jobs.noteUpdatedAt',")
        ->toContain("t('jobs.editNote')");
});

test('delete job dialog supports compact actions and optional owner context', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/delete-job-dialog.tsx');

    expect($source)
        ->toContain('showLabel?: boolean')
        ->toContain('owner?: DeleteJobOwner')
        ->toContain('avatar?: string | null')
        ->toContain('size={showLabel ? \'sm\' : \'icon\'}')
        ->toContain('aria-label={t(\'jobs.delete\')}')
        ->toContain('title={t(\'jobs.delete\')}')
        ->toContain('<span className="sr-only">{t(\'jobs.delete\')}</span>')
        ->toContain('sm:max-w-xl')
        ->toContain('DeleteJobSummary')
        ->toContain('className="table w-full table-fixed')
        ->toContain('className="table-row border-b')
        ->toContain('className="table-cell w-32')
        ->toContain('DeleteJobOwnerIdentity')
        ->toContain('AvatarImage')
        ->toContain('AvatarFallback')
        ->toContain('useInitials')
        ->toContain('owner ? (')
        ->toContain("{t('common.user')}")
        ->toContain('{owner.name}')
        ->toContain('{owner.email}')
        ->toContain('jobs.deleteDescription')
        ->not->toContain('jobs.deleteRemoteNote')
        ->not->toContain('processLabel')
        ->not->toContain('execution.processId')
        ->not->toContain('sm:max-w-md');
});

test('job pages poll while executions are active', function () {
    $indexSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');
    $indicatorSource = file_get_contents(getcwd().'/resources/js/components/ogc/job-polling-indicator.tsx');
    $helperSource = file_get_contents(getcwd().'/resources/js/lib/jobs.ts');

    expect($indexSource)
        ->toContain('pollingInterval')
        ->toContain('hasActiveJobs')
        ->toContain('isJobTerminal')
        ->toContain('<JobPollingIndicator')
        ->toContain('jobs.pollingActive')
        ->toContain('jobs.pollingInactive');

    expect($showSource)
        ->toContain('pollingInterval')
        ->toContain('isJobTerminal(execution.status)')
        ->toContain('<JobPollingIndicator')
        ->toContain('jobs.pollingShowActive')
        ->toContain('jobs.pollingShowInactive');

    expect($indicatorSource)
        ->toContain("import { usePoll } from '@inertiajs/react'")
        ->toContain("mode: 'rest'")
        ->toContain('only')
        ->toContain('activeLabel')
        ->toContain('inactiveLabel')
        ->toContain('active ? (')
        ->toContain('<ActiveJobPoller')
        ->toContain('role="status"')
        ->toContain('bg-emerald-50')
        ->toContain('text-emerald-800')
        ->toContain('animate-ping')
        ->toContain('rounded-full bg-emerald-500')
        ->toContain('bg-slate-50')
        ->toContain('text-slate-700')
        ->toContain('rounded-full bg-slate-400')
        ->not->toContain('Spinner');

    expect($helperSource)
        ->toContain('terminalStatuses')
        ->toContain('export function isJobTerminal');
});

test('job pages use readable dark mode status surfaces', function () {
    $indexSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');
    $resultPreviewSource = file_get_contents(getcwd().'/resources/js/components/ogc/result-preview.tsx');
    $indicatorSource = file_get_contents(getcwd().'/resources/js/components/ogc/job-polling-indicator.tsx');
    $helperSource = file_get_contents(getcwd().'/resources/js/lib/jobs.ts');

    expect($helperSource)
        ->toContain('dark:bg-red-500/10')
        ->toContain('dark:hover:bg-red-500/15')
        ->toContain('dark:border-red-400/70')
        ->toContain('dark:text-red-100')
        ->toContain('dark:bg-red-400')
        ->not->toContain('text-destructive');

    expect($indexSource)
        ->toContain('bg-card shadow-sm dark:border-border/70 dark:bg-card/95')
        ->toContain('dark:hover:bg-accent/30')
        ->toContain('variant="secondary"');

    expect($showSource)
        ->toContain('shadow-sm dark:bg-card/95')
        ->toContain('dark:bg-muted/60')
        ->toContain('ring-1 ring-border/50 dark:bg-muted/50');

    expect($resultPreviewSource)
        ->toContain('dark:bg-card/95')
        ->toContain('ring-1 ring-border/50 dark:bg-muted/50');

    expect($indicatorSource)
        ->toContain('dark:border-emerald-400/60')
        ->toContain('dark:border-slate-500/60');
});

test('sidebar labels process executions as jobs', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/app-sidebar.tsx');

    expect($source)
        ->toContain("title: 'My Jobs'")
        ->toContain('@/routes/jobs')
        ->not->toContain("title: 'Executions'");
});

test('flash toasts support rich descriptions and optional icons', function () {
    $source = file_get_contents(getcwd().'/resources/js/hooks/use-flash-toast.ts');
    $types = file_get_contents(getcwd().'/resources/js/types/ui.ts');

    expect($source)
        ->toContain('renderToastDescription(data)')
        ->toContain('data.icon === false ? null : getToastIcon(data.type)')
        ->toContain("'strong'")
        ->toContain("'em'");

    expect($types)
        ->toContain('details?: FlashToastDetail[]')
        ->toContain('icon?: false')
        ->toContain('note?: string');
});

test('auth status messages use the shared notice component', function () {
    foreach ([
        'resources/js/pages/auth/forgot-password.tsx',
        'resources/js/pages/auth/login.tsx',
        'resources/js/pages/auth/social-email.tsx',
        'resources/js/pages/auth/verify-otp.tsx',
        'resources/js/pages/settings/security.tsx',
    ] as $path) {
        expect(file_get_contents(getcwd().'/'.$path))
            ->toContain('StatusNotice')
            ->not->toContain('text-green-600');
    }
});

test('process pages expose cache warming states', function () {
    $indexSource = file_get_contents(getcwd().'/resources/js/pages/processes/index.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/processes/show.tsx');
    $pollerPath = getcwd().'/resources/js/components/ogc/cache-warmup-poller.tsx';

    expect($indexSource)
        ->toContain('catalogStatus')
        ->toContain('CacheWarmupPoller')
        ->toContain('ogc.servicePreparingTitle')
        ->toContain('Spinner')
        ->and($showSource)
        ->toContain('processStatus')
        ->toContain('CacheWarmupPoller')
        ->toContain('ogc.processPreparingTitle')
        ->toContain('formSchema === null')
        ->and($pollerPath)
        ->toBeFile();

    $pollerSource = file_get_contents($pollerPath);

    expect($pollerSource)
        ->toContain("import { usePoll } from '@inertiajs/react'")
        ->toContain('only')
        ->toContain("mode: 'rest'");
});
