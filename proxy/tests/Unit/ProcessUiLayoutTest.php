<?php

test('process form stacks name inputs expected outputs and note as full width sections', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($source)
        ->toContain("name: ''")
        ->toContain('ExpectedOutputs')
        ->toContain("t('jobs.processName')")
        ->toContain("t('jobs.processNamePlaceholder')")
        ->toContain("t('jobs.noteDescription')")
        ->toContain('aria-label={t(\'jobs.processName\')}')
        ->toContain('@/routes/processes/jobs')
        ->toContain('ogc.inputs')
        ->not->toContain('OutputSelector')
        ->not->toContain('outputs: initialOutputValues')
        ->not->toContain("setData('outputs'")
        ->not->toContain('ogc.execution')
        ->not->toContain('<Label htmlFor="process-name">')
        ->not->toContain('lg:grid-cols-[minmax(0,1fr)_22rem]')
        ->not->toContain('lg:sticky')
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

test('geotiff previews render through the protected map tile route', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/geotiff-map-result-preview.tsx');

    expect($source)
        ->toContain('openstreetmap')
        ->toContain('tile.openstreetmap.org')
        ->toContain('world-basemap')
        ->toContain('mapTile')
        ->toContain('geotiff-wms')
        ->toContain('attributionControl')
        ->toContain('fitBounds')
        ->toContain('MapLayerWarningAlert')
        ->toContain('ogc.mapLayerHillshadeWarning')
        ->toContain('usePage')
        ->toContain('auth.user?.is_admin')
        ->toContain('LocateFixedIcon')
        ->toContain('RecenterBoundsControl')
        ->toContain('implements IControl')
        ->toContain('map.addControl(')
        ->toContain('new RecenterBoundsControl(')
        ->toContain('maplibregl-ctrl maplibregl-ctrl-group')
        ->toContain("const recenterMapLabel = t('ogc.recenterMap')")
        ->toContain("this.button.setAttribute('aria-label', this.label)")
        ->not->toContain('<TooltipContent>{t(\'ogc.recenterMap\')}</TooltipContent>')
        ->not->toContain('absolute left-3 top-3')
        ->not->toContain('previewFile')
        ->not->toContain('buildGeoTiffMapPreview')
        ->not->toContain('geotiff-canvas');
});

test('decimal process number inputs are valid after prefill', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/schema-field-renderer.tsx');
    $tableSource = file_get_contents(getcwd().'/resources/js/components/ogc/array-table-field.tsx');

    expect($source)
        ->toContain("step={field.type === 'number' ? 'any' : undefined}")
        ->toContain('@/lib/html-pattern')
        ->toContain('htmlPatternForInput({')
        ->not->toContain('pattern={field.pattern ?? undefined}');

    expect($tableSource)
        ->toContain('@/lib/html-pattern')
        ->toContain('htmlPatternForInput({')
        ->toContain("column.type === 'number'")
        ->not->toContain('column.pattern ?? undefined');
});

test('array table fields keep a practical responsive width', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/array-table-field.tsx');

    expect($source)
        ->toContain('tableMinWidth')
        ->toContain('overflow-x-auto rounded-md border')
        ->not->toContain('min-w-[960px]');
});

test('process section fields are visually wrapped', function () {
    $wrapperSource = file_get_contents(getcwd().'/resources/js/components/ogc/section-field-set.tsx');

    expect($wrapperSource)
        ->toContain('rounded-md border')
        ->toContain('bg-muted/30')
        ->toContain('p-4')
        ->toContain('FieldLegend')
        ->toContain('FieldDescription');

    foreach ([
        'resources/js/components/ogc/schema-field-renderer.tsx',
        'resources/js/components/ogc/one-of-field.tsx',
        'resources/js/components/ogc/array-object-field.tsx',
        'resources/js/components/ogc/array-table-field.tsx',
        'resources/js/components/ogc/data-input-field.tsx',
    ] as $path) {
        expect(file_get_contents(getcwd().'/'.$path))
            ->toContain('SectionFieldSet')
            ->not->toContain('<FieldSet className="max-w-full min-w-0"');
    }
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

test('checkbox checked states render a visible indicator', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ui/checkbox.tsx');
    $css = file_get_contents(getcwd().'/resources/css/app.css');

    expect($source)
        ->toContain('data-[state=checked]:border-primary')
        ->toContain('data-[state=checked]:bg-primary')
        ->toContain('data-[state=checked]:text-primary-foreground')
        ->toContain('data-[state=indeterminate]:border-primary')
        ->toContain('data-[state=indeterminate]:bg-primary')
        ->toContain('data-[state=indeterminate]:text-primary-foreground')
        ->toContain('grid place-content-center text-current')
        ->toContain('<CheckIcon className="size-3.5" />')
        ->and($css)
        ->toContain("@source '../js';");
});

test('jobs index exposes a filterable status table', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $normalizedSource = preg_replace('/\s+/', '', $source) ?? '';
    $helperSource = file_get_contents(getcwd().'/resources/js/lib/jobs.ts');
    $copyableJobIdSource = file_get_contents(getcwd().'/resources/js/components/ogc/copyable-job-id.tsx');
    $jobIdentifiersSource = file_get_contents(getcwd().'/resources/js/components/ogc/job-identifiers.tsx');

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
        ->toContain("jobId: 'whitespace-nowrap'")
        ->toContain('@/components/ogc/job-identifiers')
        ->toContain('JobIdentifiers')
        ->toContain('remoteJobId={execution.remoteJobId}')
        ->toContain('whitespace-nowrap')
        ->toContain('styles.rowClassName')
        ->toContain('@/components/ogc/delete-job-dialog')
        ->toContain('DeleteJobButton')
        ->toContain("actions: 'w-24 text-right'")
        ->toContain("select: 'w-12'")
        ->toContain('RowSelectionState')
        ->toContain('rowSelection')
        ->toContain('onRowSelectionChange')
        ->toContain('getFilteredSelectedRowModel')
        ->toContain('createSelectColumn<ProcessExecutionListItem>()')
        ->toContain('DataTableBulkActions')
        ->toContain('bulkDestroy.url()')
        ->toContain('table.resetRowSelection()')
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
        ->not->toContain("remoteJobId: 'whitespace-nowrap'")
        ->not->toContain('max-w-[300px]')
        ->not->toContain('border-l-4 align-top')
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

    expect($jobIdentifiersSource)
        ->toContain('@/components/ogc/copyable-job-id')
        ->toContain('CopyableJobId')
        ->toContain("t('jobs.localJobId')")
        ->toContain("t('jobs.remoteJobId')")
        ->toContain('remoteJobId ?')
        ->toContain('<CopyableJobId displayJobId={value} />');

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

test('job tables expose shadcn row selection and bulk delete actions', function () {
    $jobsIndexSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $adminJobsIndexSource = file_get_contents(getcwd().'/resources/js/pages/admin/jobs/index.tsx');
    $selectColumnSource = file_get_contents(getcwd().'/resources/js/components/data-table-select-column.tsx');
    $bulkActionsSource = file_get_contents(getcwd().'/resources/js/components/data-table-bulk-actions.tsx');
    $messagesSource = file_get_contents(getcwd().'/resources/js/lib/i18n/messages.ts');

    foreach ([$jobsIndexSource, $adminJobsIndexSource] as $source) {
        $normalizedSource = preg_replace('/\s+/', '', $source) ?? '';

        expect($source)
            ->toContain('RowSelectionState')
            ->toContain('rowSelection')
            ->toContain('onRowSelectionChange')
            ->toContain('getFilteredSelectedRowModel')
            ->toContain('createSelectColumn')
            ->toContain('DataTableBulkActions')
            ->toContain('bulkDestroy.url()')
            ->toContain('router.delete<BulkActionPayload>')
            ->toContain('table.resetRowSelection()')
            ->toContain("select: 'w-12'");

        expect($normalizedSource)
            ->toContain("data-state={row.getIsSelected()?'selected':undefined}");
    }

    foreach ([$jobsIndexSource, $adminJobsIndexSource] as $source) {
        expect(strpos($source, '<DataTableBulkActions'))
            ->toBeLessThan(strpos($source, '<div className="overflow-hidden rounded-md border'));
    }

    expect($selectColumnSource)
        ->toContain("import { Checkbox } from '@/components/ui/checkbox';")
        ->toContain('table.getIsAllPageRowsSelected()')
        ->toContain('table.getIsSomePageRowsSelected()')
        ->toContain('table.toggleAllPageRowsSelected(Boolean(value))')
        ->toContain('row.getIsSelected()')
        ->toContain('row.toggleSelected(Boolean(value))')
        ->toContain("'use no memo';")
        ->toContain('event.stopPropagation()')
        ->toContain('enableSorting: false')
        ->toContain('enableHiding: false');

    expect($bulkActionsSource)
        ->toContain('CheckSquareIcon')
        ->toContain('DropdownMenuGroup')
        ->toContain('DialogTitle')
        ->toContain('DialogDescription')
        ->toContain('Spinner data-icon="inline-start"')
        ->toContain('common.chooseAction')
        ->toContain('selectionLabel')
        ->toContain('common.clearSelection')
        ->not->toContain('common.bulkActions');

    expect($messagesSource)
        ->toContain("bulkDelete: 'Elimina selezionati'")
        ->toContain("bulkDelete: 'Delete selected'")
        ->toContain("selectedJobs: '{count} processi selezionati'")
        ->toContain("selectedJobs: '{count} jobs selected'")
        ->not->toContain("bulkActions: 'Azioni bulk'");
});

test('tanstack table pages opt out of react compiler memoization', function () {
    foreach ([
        'resources/js/pages/process-executions/index.tsx',
        'resources/js/pages/admin/jobs/index.tsx',
        'resources/js/pages/admin/users/index.tsx',
    ] as $relativePath) {
        $source = file_get_contents(getcwd().'/'.$relativePath);

        expect($source)
            ->toContain("'use no memo';");
    }
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
        ->toContain("noJobsStarted: 'Non hai ancora avviato processi.'")
        ->toContain("startProcess: 'Avvia un processo'")
        ->toContain("noUserJobsStarted: 'Nessun processo avviato dagli utenti.'")
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

test('job detail prioritizes collapsible output panels and header metadata without summary section', function () {
    $source = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');
    $messagesSource = file_get_contents(getcwd().'/resources/js/lib/i18n/messages.ts');
    $inputPosition = strpos($source, "title={t('jobs.inputs')}");
    $outputPosition = strpos($source, "title={t('ogc.outputs')}");
    $notePosition = strpos($source, '<JobNoteCard execution={execution} />');
    $headerMetaPosition = strpos($source, 'HeaderMetadata');
    $titleEditPosition = strpos($source, '<JobNameEditDialog execution={execution} />');
    $processTitlePosition = strpos($source, '<p className="text-sm text-muted-foreground">');

    expect($source)
        ->toContain('@/components/ogc/job-identifiers')
        ->toContain('@/components/ogc/job-name-edit-dialog')
        ->toContain('@/routes/jobs')
        ->toContain('jobStatusStyles')
        ->toContain('JobNameEditDialog')
        ->toContain('JobIdentifiers')
        ->toContain('remoteJobId')
        ->toContain('remoteJobId={execution.remoteJobId}')
        ->toContain('inline')
        ->toContain('common.status')
        ->toContain('jobs.results')
        ->toContain('jobs.progress')
        ->toContain("import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';")
        ->toContain("import { Spinner } from '@/components/ui/spinner';")
        ->toContain('OutputPendingNotice')
        ->toContain('<Alert')
        ->toContain('<Spinner />')
        ->toContain("t('jobs.outputPendingTitle')")
        ->toContain("t('jobs.outputPendingDescription')")
        ->toContain('isPolling ? (')
        ->toContain("t('jobs.adminOnlySection')")
        ->toContain('ShieldCheckIcon')
        ->toContain('<ShieldCheckIcon data-icon="inline-start" />')
        ->toContain('CalendarClockIcon')
        ->toContain('Clock3Icon')
        ->toContain('FileInputIcon')
        ->toContain('PackageCheckIcon')
        ->toContain('icon={FileInputIcon}')
        ->toContain('icon={PackageCheckIcon}')
        ->toContain('<HeaderMetadata')
        ->toContain('<HeaderMetadataItem')
        ->toContain('<HeaderProgressItem')
        ->toContain("label={t('jobs.created')}")
        ->toContain("label={t('jobs.submitted')}")
        ->toContain('label={terminalLabel}')
        ->toContain('formatJobDate')
        ->toContain('max-w-full overflow-x-auto')
        ->toContain('flex w-max flex-nowrap items-center gap-x-4 border-y border-border/60 py-2')
        ->toContain('border-l border-border/60 pl-4 text-xs whitespace-nowrap first:border-l-0 first:pl-0')
        ->toContain('HeaderMetadataValue')
        ->toContain('HeaderMetadataProgress')
        ->toContain('variant="destructive"')
        ->toContain('className="h-5 shrink-0 px-1.5 text-[10px] uppercase"')
        ->toContain('className="flex justify-end lg:pt-9"')
        ->toContain('DeleteJobButton')
        ->toContain('className="w-full sm:w-auto"')
        ->toContain('<JobNameEditDialog execution={execution} />')
        ->toContain('<JobNoteCard execution={execution} />')
        ->not->toContain('ActivityIcon')
        ->not->toContain('HashIcon')
        ->not->toContain('jobs.jobSummary')
        ->not->toContain('jobs.requestedOutputs')
        ->not->toContain('value={execution.requestedOutputs ?? {}}')
        ->not->toContain('jobs.currentState')
        ->not->toContain('execution.message')
        ->not->toContain('HeaderMetric')
        ->not->toContain('HeaderDate')
        ->not->toContain('flex flex-wrap items-center justify-end')
        ->not->toContain('lg:w-[40rem]')
        ->not->toContain('SummaryMetric')
        ->not->toContain('SummaryProgress')
        ->not->toContain('SummaryDate')
        ->not->toContain('label={t(\'jobs.local\')}')
        ->not->toContain('value={`#${execution.id}`}')
        ->not->toContain('lg:max-w-3xl')
        ->not->toContain('lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]')
        ->not->toContain('<JobNameCard execution={execution} />')
        ->not->toContain('xl:grid-cols-[minmax(0,1fr)_24rem]')
        ->not->toContain('xl:sticky')
        ->not->toContain('<code className="min-w-0 truncate');

    expect(strpos($source, 'isPolling ? ('))
        ->toBeLessThan(strpos($source, 'execution.results.length > 0 ? ('));

    expect($messagesSource)
        ->toContain("outputPendingTitle: 'Processo in corso'")
        ->toContain('outputPendingDescription')
        ->toContain('Gli output saranno disponibili al completamento con esito positivo.')
        ->toContain("outputPendingTitle: 'Job in progress'")
        ->toContain('Outputs will be available when the job completes successfully.');

    expect($headerMetaPosition)->not->toBeFalse()
        ->and($titleEditPosition)->not->toBeFalse()
        ->and($processTitlePosition)->not->toBeFalse()
        ->and($inputPosition)->not->toBeFalse()
        ->and($outputPosition)->not->toBeFalse()
        ->and($notePosition)->not->toBeFalse()
        ->and($titleEditPosition)->toBeLessThan($headerMetaPosition)
        ->and($headerMetaPosition)->toBeLessThan($processTitlePosition)
        ->and($notePosition)->toBeLessThan($outputPosition)
        ->and($outputPosition)->toBeLessThan($inputPosition);
});

test('job output result cards are collapsible taller sections with title icons', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/result-preview.tsx');
    $mapSource = file_get_contents(getcwd().'/resources/js/components/ogc/geotiff-map-result-preview.tsx');

    expect($source)
        ->toContain('ChevronDownIcon')
        ->toContain('FileTextIcon')
        ->toContain('Collapsible')
        ->toContain('CollapsibleContent')
        ->toContain('CollapsibleTrigger')
        ->toContain('<Collapsible defaultOpen asChild>')
        ->toContain('[&[data-state=open]>svg]:rotate-180')
        ->toContain('<FileTextIcon')
        ->toContain('min-h-96')
        ->toContain('max-h-[32rem]')
        ->toContain('<CardTitle className="flex min-w-0 items-center gap-2">');

    expect($mapSource)
        ->toContain('ChevronDownIcon')
        ->toContain('MapIcon')
        ->toContain('Collapsible')
        ->toContain('CollapsibleContent')
        ->toContain('CollapsibleTrigger')
        ->toContain('<Collapsible defaultOpen asChild>')
        ->toContain('[&[data-state=open]>svg]:rotate-180')
        ->toContain('<MapIcon')
        ->toContain('h-[28rem] min-h-[28rem]')
        ->toContain('<CardTitle className="flex min-w-0 items-center gap-2">');
});

test('job editable metadata appears on create and detail screens', function () {
    $formSource = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');
    $editorPath = getcwd().'/resources/js/components/ogc/job-note-editor.tsx';
    $cardPath = getcwd().'/resources/js/components/ogc/job-note-card.tsx';
    $nameDialogPath = getcwd().'/resources/js/components/ogc/job-name-edit-dialog.tsx';
    $nameCardPath = getcwd().'/resources/js/components/ogc/job-name-card.tsx';

    expect($formSource)
        ->toContain('@/components/ogc/job-note-editor')
        ->toContain("name: ''")
        ->toContain("setData('name', event.target.value)")
        ->toContain('note: null')
        ->toContain("setData('note', note)");

    expect($showSource)
        ->toContain('@/components/ogc/job-note-card')
        ->toContain('@/components/ogc/job-name-edit-dialog')
        ->toContain('<JobNameEditDialog execution={execution} />')
        ->toContain('<JobNoteCard execution={execution} />')
        ->not->toContain('<JobNameCard execution={execution} />');

    expect($editorPath)->toBeFile()
        ->and($cardPath)->toBeFile()
        ->and($nameDialogPath)->toBeFile()
        ->and($nameCardPath)->not->toBeFile();

    $editorSource = file_get_contents($editorPath);
    $cardSource = file_get_contents($cardPath);
    $nameDialogSource = file_get_contents($nameDialogPath);
    $cssSource = file_get_contents(getcwd().'/resources/css/app.css');

    expect($editorSource)
        ->toContain('@tiptap/react')
        ->toContain('@tiptap/starter-kit')
        ->toContain('@tiptap/extension-link')
        ->toContain('link: false')
        ->toContain('BoldIcon')
        ->toContain('ItalicIcon')
        ->toContain('ListIcon')
        ->toContain('ListOrderedIcon')
        ->toContain('QuoteIcon')
        ->toContain('Code2Icon')
        ->toContain('LinkIcon')
        ->toContain('Undo2Icon')
        ->toContain('Redo2Icon')
        ->toContain("t('jobs.noteToolbar.codeBlock')")
        ->toContain('editor.chain().focus().toggleCodeBlock().run()')
        ->toContain("editor.isActive('codeBlock')")
        ->not->toContain('codeBlock: false');

    expect($cssSource)
        ->toContain('.prose-note pre')
        ->toContain('.prose-note code');

    expect($cardSource)
        ->toContain('@/routes/jobs/note')
        ->toContain('onOpenAutoFocus={(event) => event.preventDefault()}')
        ->toContain('CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"')
        ->toContain('<div className="min-w-0">')
        ->toContain('<JobNoteEditor')
        ->toContain('autoFocus')
        ->toContain('DialogTitle')
        ->toContain("t('jobs.editNoteDescription')")
        ->toContain("t('jobs.editNote')")
        ->toContain('className="w-full sm:w-fit"')
        ->toContain('CardContent className="min-w-0"')
        ->not->toContain("t('jobs.noteDescription')")
        ->not->toContain('min-h-16 rounded-md border bg-background px-3 py-2 dark:bg-muted/30');

    expect($editorSource)
        ->toContain('autoFocus = false')
        ->toContain("editor.commands.focus('end')")
        ->toContain('requestAnimationFrame')
        ->toContain('cancelAnimationFrame');

    expect($nameDialogSource)
        ->toContain('@/routes/jobs/name')
        ->toContain("t('jobs.editProcessName')")
        ->toContain("t('jobs.saveProcessName')")
        ->toContain('PencilIcon')
        ->toContain('aria-label={t(\'jobs.editProcessName\')}')
        ->toContain('title={t(\'jobs.editProcessName\')}')
        ->toContain('<span className="sr-only">{t(\'jobs.editProcessName\')}</span>');
});

test('job metadata changes refresh stale job table history', function () {
    $indexSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/index.tsx');
    $adminIndexSource = file_get_contents(getcwd().'/resources/js/pages/admin/jobs/index.tsx');
    $nameDialogSource = file_get_contents(getcwd().'/resources/js/components/ogc/job-name-edit-dialog.tsx');
    $processFormSource = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');

    expect($indexSource)
        ->toContain('@/lib/job-list-refresh')
        ->toContain('consumeJobsIndexStale')
        ->toContain("router.reload({ only: ['executions', 'pollingInterval'] })");

    expect($adminIndexSource)
        ->toContain('@/lib/job-list-refresh')
        ->toContain('consumeAdminJobsIndexStale')
        ->toContain("router.reload({ only: ['executions'] })");

    expect($nameDialogSource)
        ->toContain('@/lib/job-list-refresh')
        ->toContain('markJobsIndexStale')
        ->toContain('markJobsIndexStale();');

    expect($processFormSource)
        ->toContain('@/lib/job-list-refresh')
        ->toContain('markJobsIndexStale')
        ->toContain('onSuccess: () => markJobsIndexStale()');
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
        ->toContain('showRemoteJobId')
        ->toContain('Boolean(execution.remoteJobId)')
        ->toContain('showRemoteJobId || owner')
        ->toContain("{t('jobs.localJobId')}")
        ->toContain('showRemoteJobId ? (')
        ->toContain("{t('jobs.remoteJobId')}")
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
        ->toContain('dark:border-border/70 dark:bg-card/95')
        ->toContain('dark:bg-background/30')
        ->toContain('ring-1 ring-border/50 dark:bg-muted/50');

    expect($resultPreviewSource)
        ->toContain('dark:bg-card/95')
        ->toContain('ring-1 ring-border/50 dark:bg-muted/50');

    expect($indicatorSource)
        ->toContain('dark:border-emerald-400/60')
        ->toContain('dark:border-slate-500/60');
});

test('csv result previews use structured normalization instead of comma splitting in the component', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/result-preview.tsx');

    expect($source)
        ->toContain("import { normalizeCsvPreview } from '@/lib/csv-preview'")
        ->toContain('const csv = normalizeCsvPreview(data)')
        ->not->toContain("row.split(',')");
});

test('expected outputs renders a simple unordered list', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/expected-outputs.tsx');

    expect($source)
        ->toContain('<ul')
        ->toContain('list-disc')
        ->toContain('output.title')
        ->toContain('output.description')
        ->not->toContain('output.mediaType')
        ->not->toContain('automaticOutputTransmissionMode')
        ->not->toContain('outputComponents');
});

test('one of descriptions are shown before the selector', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/one-of-field.tsx');

    $fieldDescriptionPosition = strpos($source, 'description={field.description}');
    $selectedDescriptionPosition = strpos($source, 'selected.description ? (');
    $selectPosition = strpos($source, '<Select');

    expect($fieldDescriptionPosition)->not->toBeFalse()
        ->and($selectedDescriptionPosition)->not->toBeFalse()
        ->and($selectPosition)->not->toBeFalse()
        ->and($fieldDescriptionPosition)->toBeLessThan($selectPosition)
        ->and($selectedDescriptionPosition)->toBeLessThan($selectPosition);
});

test('process form does not expose output selection controls', function () {
    $source = file_get_contents(getcwd().'/resources/js/components/ogc/dynamic-process-form.tsx');
    $helperSource = file_get_contents(getcwd().'/resources/js/lib/ogc-outputs.ts');

    expect($source)
        ->toContain('<ExpectedOutputs outputs={schema.outputs} />')
        ->not->toContain('initialOutputValues(schema.outputs)')
        ->not->toContain('exampleTransmissionMode(')
        ->not->toContain("setData('outputs'");

    expect($helperSource)
        ->toContain('automaticOutputTransmissionMode')
        ->toContain("'text/plain'")
        ->toContain("endsWith('+json')")
        ->toContain("'reference'");
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

test('process pages show service configuration update dates', function () {
    $indexSource = file_get_contents(getcwd().'/resources/js/pages/processes/index.tsx');
    $showSource = file_get_contents(getcwd().'/resources/js/pages/processes/show.tsx');
    $messagesSource = file_get_contents(getcwd().'/resources/js/lib/i18n/messages.ts');

    expect($indexSource)
        ->toContain('catalogLastUpdatedAt')
        ->toContain('formatJobDate')
        ->toContain('ogc.servicesLastUpdatedAt')
        ->and($showSource)
        ->toContain('processLastUpdatedAt')
        ->toContain('formatJobDate')
        ->toContain('ogc.servicesLastUpdatedAt')
        ->and($messagesSource)
        ->toContain('Ultimo aggiornamento servizi')
        ->toContain('Services last updated');
});

test('job detail groups geotiff and sld results for map previews', function () {
    $showSource = file_get_contents(getcwd().'/resources/js/pages/process-executions/show.tsx');

    expect($showSource)
        ->toContain('groupProcessResults(execution.results)')
        ->toContain('<GeoTiffMapResultPreview')
        ->toContain('visualResults.length')
        ->toContain("item.kind === 'geotiff-map'");
});
