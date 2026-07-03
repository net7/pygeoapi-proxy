export type OgcCacheStatus = 'ready' | 'warming';

export type OgcProcessSummary = {
    id: string;
    title?: string;
    description?: string;
    version?: string;
    jobControlOptions?: string[];
    outputTransmission?: string[];
};

export type OgcNormalizedField = {
    name: string;
    title: string;
    description?: string | null;
    kind:
        | 'scalar'
        | 'enum'
        | 'object'
        | 'oneOf'
        | 'array_object'
        | 'array_table'
        | 'array_scalar';
    type?: string;
    required?: boolean | string[];
    fields?: Record<string, OgcNormalizedField>;
    variants?: {
        id: string;
        label: string;
        description?: string | null;
        required: string[];
        fields: Record<string, OgcNormalizedField>;
    }[];
    options?: Array<string | number | boolean>;
    minItems?: number | null;
    maxItems?: number | null;
    columns?: {
        key: string;
        label: string;
        type: string;
        pattern?: string | null;
    }[];
    minimum?: number | null;
    maximum?: number | null;
    exclusiveMinimum?: number | null;
    exclusiveMaximum?: number | null;
    pattern?: string | null;
    mediaType?: string | null;
    contentEncoding?: string | null;
    references?: { label: string; href: string; mediaType?: string | null }[];
};

export type OgcNormalizedOutput = {
    name: string;
    title: string;
    description?: string | null;
    mediaType?: string | null;
    contentEncoding?: string | null;
    schemaRef?: string | null;
};

export type OgcExamplePayload = {
    inputs?: Record<string, unknown>;
    outputs?:
        | Record<string, { transmissionMode?: string } | string | unknown>
        | string[];
};

export type OgcFormSchema = {
    id: string;
    title: string;
    description?: string | null;
    version?: string | null;
    jobControlOptions: string[];
    outputTransmission: string[];
    fields: Record<string, OgcNormalizedField>;
    outputs: Record<string, OgcNormalizedOutput>;
    examplePayload?: OgcExamplePayload | null;
};

export type TiptapDocument = {
    type: 'doc';
    content?: Array<Record<string, any>>;
};

export type ProcessExecutionListItem = {
    id: number;
    name?: string | null;
    displayName: string;
    remoteJobId?: string | null;
    processId: string;
    processTitle?: string | null;
    status: string;
    progress: number;
    message?: string | null;
    createdAt?: string | null;
    submittedAt?: string | null;
    completedAt?: string | null;
    failedAt?: string | null;
};

export type ProcessExecutionResult = {
    id: number;
    outputId: string;
    title?: string | null;
    description?: string | null;
    mediaType?: string | null;
    cacheStatus: string;
    preview?: { kind: string; data: unknown } | null;
};

export type ProcessExecutionDetail = ProcessExecutionListItem & {
    processVersion?: string | null;
    note?: TiptapDocument | null;
    noteUpdatedAt?: string | null;
    requestPayload?: Record<string, unknown> | null;
    requestedOutputs?: Record<string, unknown> | null;
    results: ProcessExecutionResult[];
};
