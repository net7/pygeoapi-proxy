import type { ProcessExecutionDetail } from '@/types';

export function jobStorageVersion(
    execution: Pick<ProcessExecutionDetail, 'status'> &
        Partial<Pick<ProcessExecutionDetail, 'resultCollection' | 'results'>>,
): string {
    return JSON.stringify([
        execution.status,
        execution.resultCollection?.status ?? null,
        (execution.results ?? []).map((result) => [
            result.id,
            result.cacheStatus,
            result.mapLayer.status,
            result.mapLayer.publishedAt,
        ]),
    ]);
}

export function formatStorageBytes(bytes: number, locale: string): string {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    const unit =
        bytes > 0
            ? Math.min(
                  Math.floor(Math.log(bytes) / Math.log(1024)),
                  units.length - 1,
              )
            : 0;

    return `${(bytes / 1024 ** unit).toLocaleString(locale, {
        maximumFractionDigits: unit === 0 ? 0 : 2,
    })} ${units[unit]}`;
}
