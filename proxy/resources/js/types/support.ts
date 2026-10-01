export type SupportLimits = {
    maxAttachments: number;
    maxFileBytes: number;
    allowedExtensions: string[];
};

export type SupportFormValues = {
    subject: string;
    description: string;
    email: string;
    attachments: File[];
};
