export type SupportLimits = {
    maxAttachments: number;
    maxFileBytes: number;
    allowedExtensions: string[];
};

export type TechnicalContact = { id: number; name: string; email: string };

export type SupportConfiguration = SupportLimits & {
    allowGuests: boolean;
    available: boolean;
    isTechnicalContact: boolean;
};

export type SupportFormValues = {
    subject: string;
    description: string;
    email: string;
    attachments: File[];
};

export type SupportClientContext = {
    language?: string;
    timezone?: string;
    viewport_width?: number;
    viewport_height?: number;
};
