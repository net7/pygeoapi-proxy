import type {
    ColumnDef,
    Row,
    Table as TanStackTable,
} from '@tanstack/react-table';

import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/hooks/use-translation';

export function createSelectColumn<TData>(): ColumnDef<TData> {
    return {
        id: 'select',
        header: ({ table }) => <SelectAllRowsCheckbox table={table} />,
        cell: ({ row }) => <SelectRowCheckbox row={row} />,
        enableHiding: false,
        enableSorting: false,
    };
}

function SelectAllRowsCheckbox<TData>({
    table,
}: {
    table: TanStackTable<TData>;
}) {
    'use no memo';

    const { t } = useTranslation();

    return (
        <Checkbox
            checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(Boolean(value))
            }
            aria-label={t('common.selectAllRows')}
        />
    );
}

function SelectRowCheckbox<TData>({ row }: { row: Row<TData> }) {
    'use no memo';

    const { t } = useTranslation();

    return (
        <Checkbox
            checked={row.getIsSelected()}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label={t('common.selectRow')}
        />
    );
}
