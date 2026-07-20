import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';

import type { TranslationKey, TranslationValues } from '@/lib/i18n/translation';
import type { OgcFormErrors } from '@/lib/ogc-form-errors';
import { isOneOfValue, pruneOptionalInputValues } from '@/lib/ogc-form-values';
import { ogcPatternValidationMessage } from '@/lib/ogc-pattern-validation';
import type { OgcNormalizedField } from '@/types';

type OgcAjvTranslator = (
    key: TranslationKey,
    values?: TranslationValues,
) => string;

type ItemPropertySumConstraint = {
    property: string;
    exclusiveMaximum: number;
};

type OgcAjvValidationOptions = {
    schema: Record<string, unknown>;
    fields: Record<string, OgcNormalizedField>;
    inputs: Record<string, unknown>;
    translate: OgcAjvTranslator;
};

const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    ownProperties: true,
    removeAdditional: false,
    strictRequired: false,
    strictTypes: false,
    verbose: true,
});

ajv.addKeyword({
    keyword: 'itemPropertySum',
    type: 'array',
    schemaType: 'object',
    errors: false,
    validate: (constraint: unknown, data: unknown): boolean =>
        validatesItemPropertySum(constraint, data),
});

const validatorCache = new WeakMap<
    Record<string, unknown>,
    Map<string, ValidateFunction>
>();

export function validateOgcInputs({
    schema,
    fields,
    inputs,
    translate,
}: OgcAjvValidationOptions): OgcFormErrors {
    const prunedInputs = pruneOptionalInputValues(fields, inputs);
    const { activeSchema, cacheKey } = schemaForSelectedVariants(
        schema,
        fields,
        prunedInputs,
    );
    const validate = validatorFor(schema, activeSchema, cacheKey);
    const validationInputs = inputsForValidation(fields, prunedInputs);

    if (validate(validationInputs)) {
        return {};
    }

    return errorsForForm(validate.errors ?? [], fields, translate);
}

function validatorFor(
    sourceSchema: Record<string, unknown>,
    activeSchema: Record<string, unknown>,
    cacheKey: string,
): ValidateFunction {
    let validators = validatorCache.get(sourceSchema);

    if (!validators) {
        validators = new Map<string, ValidateFunction>();
        validatorCache.set(sourceSchema, validators);
    }

    const cached = validators.get(cacheKey);

    if (cached) {
        return cached;
    }

    const validate = ajv.compile(activeSchema);
    validators.set(cacheKey, validate);

    return validate;
}

function schemaForSelectedVariants(
    schema: Record<string, unknown>,
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): { activeSchema: Record<string, unknown>; cacheKey: string } {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const activeProperties: Record<string, unknown> = {};
    const selections: string[] = [];
    let changed = false;

    for (const [name, propertySchema] of Object.entries(properties)) {
        const field = fields[name];
        const value = inputs[name];

        if (
            field?.kind !== 'oneOf' ||
            !isOneOfValue(value) ||
            !isRecord(propertySchema) ||
            !Array.isArray(propertySchema.oneOf)
        ) {
            activeProperties[name] = propertySchema;

            continue;
        }

        const variantIndex = field.variants?.findIndex(
            (variant) => variant.id === value.variant,
        );
        const variantSchema =
            variantIndex !== undefined && variantIndex >= 0
                ? propertySchema.oneOf[variantIndex]
                : null;

        if (!isRecord(variantSchema)) {
            activeProperties[name] = propertySchema;

            continue;
        }

        const { oneOf: omittedOneOf, ...baseSchema } = propertySchema;
        void omittedOneOf;
        activeProperties[name] = {
            ...baseSchema,
            ...variantSchema,
        };
        selections.push(`${name}:${value.variant}`);
        changed = true;
    }

    return {
        activeSchema: changed
            ? { ...schema, properties: activeProperties }
            : schema,
        cacheKey: selections.sort().join('|'),
    };
}

function inputsForValidation(
    fields: Record<string, OgcNormalizedField>,
    inputs: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(inputs).map(([name, value]) => [
            name,
            fields[name]?.kind === 'oneOf' && isOneOfValue(value)
                ? value.value
                : value,
        ]),
    );
}

function errorsForForm(
    validationErrors: ErrorObject[],
    fields: Record<string, OgcNormalizedField>,
    translate: OgcAjvTranslator,
): OgcFormErrors {
    const errors: OgcFormErrors = {};

    for (const validationError of validationErrors) {
        const path = formPath(validationError, fields);

        errors[path] ??= errorMessage(validationError, translate);
    }

    return errors;
}

function formPath(
    error: ErrorObject,
    fields: Record<string, OgcNormalizedField>,
): string {
    const segments = error.instancePath
        .split('/')
        .slice(1)
        .map(decodeJsonPointerSegment);

    if (error.keyword === 'required') {
        const missingProperty = stringParameter(
            error.params,
            'missingProperty',
        );

        if (missingProperty !== null) {
            segments.push(missingProperty);
        }
    }

    if (error.keyword === 'additionalProperties') {
        const additionalProperty = stringParameter(
            error.params,
            'additionalProperty',
        );

        if (additionalProperty !== null) {
            segments.push(additionalProperty);
        }
    }

    const [inputName, ...nestedSegments] = segments;

    if (!inputName) {
        return 'inputs';
    }

    const field = fields[inputName];
    const wrapper =
        nestedSegments.length > 0 &&
        (field?.kind === 'object' || field?.kind === 'oneOf')
            ? ['value']
            : [];

    return ['inputs', inputName, ...wrapper, ...nestedSegments].join('.');
}

function errorMessage(error: ErrorObject, translate: OgcAjvTranslator): string {
    if (error.keyword === 'required') {
        return translate('ogc.validationRequired');
    }

    if (error.keyword === 'additionalProperties') {
        return error.instancePath === ''
            ? translate('ogc.validationUndeclaredInput')
            : translate('ogc.validationAdditionalProperty');
    }

    if (error.keyword === 'enum') {
        return translate('ogc.validationOption');
    }

    if (error.keyword === 'pattern') {
        const pattern = (error as ErrorObject & { schema?: unknown }).schema;

        return ogcPatternValidationMessage(
            typeof pattern === 'string' ? pattern : null,
            translate,
        );
    }

    if (error.keyword === 'minimum') {
        return translate('ogc.validationMinimum', {
            value: numericParameter(error.params, 'limit'),
        });
    }

    if (error.keyword === 'maximum') {
        return translate('ogc.validationMaximum', {
            value: numericParameter(error.params, 'limit'),
        });
    }

    if (error.keyword === 'exclusiveMinimum') {
        return translate('ogc.validationExclusiveMinimum', {
            value: numericParameter(error.params, 'limit'),
        });
    }

    if (error.keyword === 'exclusiveMaximum') {
        return translate('ogc.validationExclusiveMaximum', {
            value: numericParameter(error.params, 'limit'),
        });
    }

    if (error.keyword === 'minItems') {
        return translate('ogc.validationMinimumItems', {
            count: numericParameter(error.params, 'limit'),
        });
    }

    if (error.keyword === 'maxItems') {
        return translate('ogc.validationMaximumItems', {
            count: numericParameter(error.params, 'limit'),
        });
    }

    if (error.keyword === 'type') {
        const expectedType = stringParameter(error.params, 'type');

        if (expectedType === 'integer') {
            return translate('ogc.validationInteger');
        }

        if (expectedType === 'number') {
            return translate('ogc.validationInvalidNumber');
        }
    }

    if (error.keyword === 'itemPropertySum') {
        const constraint = isItemPropertySumConstraint(
            (error as ErrorObject & { schema?: unknown }).schema,
        )
            ? (
                  error as ErrorObject & {
                      schema: ItemPropertySumConstraint;
                  }
              ).schema
            : null;

        return constraint
            ? translate('ogc.validationItemPropertySum', {
                  property: constraint.property,
                  value: constraint.exclusiveMaximum,
              })
            : translate('ogc.validationInvalid');
    }

    return translate('ogc.validationInvalid');
}

function validatesItemPropertySum(constraint: unknown, data: unknown): boolean {
    if (!isItemPropertySumConstraint(constraint) || !Array.isArray(data)) {
        return true;
    }

    let sum = 0;

    for (const item of data) {
        if (!isRecord(item)) {
            return true;
        }

        const propertyValue = item[constraint.property];

        if (
            typeof propertyValue !== 'number' ||
            !Number.isFinite(propertyValue)
        ) {
            return true;
        }

        sum += propertyValue;
    }

    const tolerance =
        Math.max(1, Math.abs(sum), Math.abs(constraint.exclusiveMaximum)) *
        Number.EPSILON;

    return sum < constraint.exclusiveMaximum - tolerance;
}

function isItemPropertySumConstraint(
    value: unknown,
): value is ItemPropertySumConstraint {
    return (
        isRecord(value) &&
        typeof value.property === 'string' &&
        typeof value.exclusiveMaximum === 'number' &&
        Number.isFinite(value.exclusiveMaximum)
    );
}

function stringParameter(
    parameters: Record<string, unknown>,
    name: string,
): string | null {
    const value = parameters[name];

    return typeof value === 'string' ? value : null;
}

function numericParameter(
    parameters: Record<string, unknown>,
    name: string,
): number {
    const value = parameters[name];

    return typeof value === 'number' ? value : 0;
}

function decodeJsonPointerSegment(segment: string): string {
    return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
