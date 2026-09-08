import { DownloadIcon, InfoIcon } from 'lucide-react';

import { FieldSupportReference } from '@/components/ogc/input-support';
import ReadOnlyFieldValue from '@/components/ogc/read-only-field-value';
import SchemaFieldRenderer from '@/components/ogc/schema-field-renderer';
import SectionFieldSet from '@/components/ogc/section-field-set';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { fieldDisplayLabel } from '@/lib/ogc-fields';
import type { OgcFieldValidationController } from '@/lib/ogc-form-validation';
import { reviewInputValues } from '@/lib/ogc-form-values';
import { download } from '@/routes/jobs/inputs';
import type { OgcInputReview, ProcessExecutionDetail } from '@/types';

const ignoreChange = () => undefined;
const readOnlyValidation: OgcFieldValidationController = {
    errors: {},
    validLabel: '',
    stateFor: () => 'neutral',
    fieldChanged: ignoreChange,
    resetPathPrefix: ignoreChange,
    valuesReplaced: ignoreChange,
};

export default function ProcessInputReview({
    review,
    execution,
}: {
    review: OgcInputReview;
    execution: ProcessExecutionDetail;
}) {
    const { t, locale } = useTranslation();
    const values = reviewInputValues(review.fields, review.inputs);
    const unavailable = new Set(review.unavailableInputs);
    const unavailableLabels = review.unavailableInputs.map((name) =>
        review.fields[name] ? fieldDisplayLabel(review.fields[name]) : name,
    );

    return (
        <FieldGroup>
            {review.legacy ? (
                <Alert>
                    <InfoIcon aria-hidden="true" />
                    <AlertDescription>
                        {t('jobs.inputReviewLegacy')}
                    </AlertDescription>
                </Alert>
            ) : null}
            {unavailable.size > 0 ? (
                <Alert>
                    <InfoIcon aria-hidden="true" />
                    <AlertDescription>
                        {t('jobs.inputReviewIncomplete', {
                            inputs: unavailableLabels.join(', '),
                        })}
                    </AlertDescription>
                </Alert>
            ) : null}
            {Object.entries(review.fields).map(([name, field]) =>
                unavailable.has(name) ? (
                    <ReadOnlyFieldValue
                        key={name}
                        field={field}
                        value={t('jobs.inputUnavailable')}
                        path={'inputs.' + name}
                    />
                ) : (
                    <SchemaFieldRenderer
                        key={name}
                        field={field}
                        value={values[name]}
                        path={'inputs.' + name}
                        validation={readOnlyValidation}
                        onChange={ignoreChange}
                        topLevel
                        readOnly
                    />
                ),
            )}
            {Object.keys(review.fields).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('jobs.inputReviewEmpty')}
                </p>
            ) : null}
            {review.files.length > 0 ? (
                <SectionFieldSet label={t('jobs.submittedFiles')}>
                    <ul className="flex min-w-0 flex-col gap-3">
                        {review.files.map((file) => (
                            <li
                                key={file.id}
                                className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                                        <p className="text-sm font-medium break-all">
                                            {file.name}
                                        </p>
                                        <FieldSupportReference
                                            name={file.path.join('.')}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {file.sizeBytes.toLocaleString(locale)}{' '}
                                        bytes
                                        {file.mediaType
                                            ? ' · ' + file.mediaType
                                            : ''}
                                    </p>
                                </div>
                                {file.available ? (
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="w-fit shrink-0"
                                    >
                                        <a
                                            href={download.url({
                                                processExecution: execution.id,
                                                file: file.id,
                                            })}
                                        >
                                            <DownloadIcon data-icon="inline-start" />
                                            {t('common.download')}
                                            <span className="sr-only">
                                                {' '}
                                                {file.name}
                                            </span>
                                        </a>
                                    </Button>
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        {t('jobs.inputUnavailable')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </SectionFieldSet>
            ) : null}
        </FieldGroup>
    );
}
