import JsonView from '@uiw/react-json-view';
import { nordTheme } from '@uiw/react-json-view/nord';

export default function JsonPayloadContent({ value }: { value: object }) {
    return (
        <JsonView
            value={value}
            style={nordTheme}
            enableClipboard={false}
            className="max-h-[32rem] min-h-80 overflow-auto rounded-md p-3 text-xs ring-1 ring-border/50"
        />
    );
}
