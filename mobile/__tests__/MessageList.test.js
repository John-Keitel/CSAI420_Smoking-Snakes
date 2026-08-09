import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, StyleSheet } from 'react-native';

import MessageList, { MASKED_MESSAGE } from '../app/components/chat/MessageList';
import { speak } from '../app/lib/voiceController';

jest.mock('../app/lib/voiceController', () => ({
    speak: jest.fn(),
}));

const transcript = [
    { role: 'assistant', message: "I'd be happy to help! What's your name?" },
    { role: 'user', message: 'Alex Johnson' },
    { role: 'assistant', message: 'Great! What is your email address?' },
];

afterEach(() => {
    jest.restoreAllMocks();
    speak.mockClear();
});

describe('rendering the transcript (MSG-01)', () => {
    it('renders every entry in order', () => {
        render(<MessageList entries={transcript} />);

        transcript.forEach((entry, index) => {
            expect(screen.getByTestId(`chat-message-${index}`)).toBeTruthy();
        });

        expect(screen.getByText('Alex Johnson')).toBeTruthy();
    });

    it('styles user and assistant turns differently', () => {
        render(<MessageList entries={transcript} />);

        const assistant = StyleSheet.flatten(screen.getByTestId('chat-message-0').props.style);
        const user = StyleSheet.flatten(screen.getByTestId('chat-message-1').props.style);

        expect(assistant.alignSelf).toBe('flex-start');
        expect(user.alignSelf).toBe('flex-end');
        expect(assistant.backgroundColor).not.toBe(user.backgroundColor);
    });

    it('identifies the speaker for screen readers', () => {
        render(<MessageList entries={transcript} />);

        expect(screen.getByTestId('chat-message-1').props.accessibilityLabel).toBe('You said: Alex Johnson');
        expect(screen.getByTestId('chat-message-0').props.accessibilityLabel).toContain('Assistant said:');
    });
});

describe('auto-scrolling (MSG-02)', () => {
    it('scrolls to the newest entry when the content grows', () => {
        const scrollToEnd = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => {});

        render(<MessageList entries={transcript} />);

        fireEvent(screen.getByTestId('chat-transcript'), 'contentSizeChange', 320, 900);

        expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
    });
});

describe('accumulating turns (MSG-04)', () => {
    it('grows as each exchange completes', () => {
        const { rerender } = render(<MessageList entries={transcript.slice(0, 1)} />);

        expect(screen.queryByTestId('chat-message-1')).toBeNull();

        rerender(<MessageList entries={transcript} />);

        expect(screen.getByTestId('chat-message-1')).toBeTruthy();
        expect(screen.getByTestId('chat-message-2')).toBeTruthy();
    });
});

describe('masking the credential turn (MSG-03)', () => {
    const withPassword = [...transcript, { role: 'user', message: 'Str0ngP@ssw0rd!' }];

    it('renders a placeholder instead of the typed password', () => {
        render(<MessageList entries={withPassword} maskedIndexes={[3]} />);

        expect(screen.queryByText('Str0ngP@ssw0rd!')).toBeNull();
        expect(screen.getByText(MASKED_MESSAGE)).toBeTruthy();
    });

    it('keeps the password out of the accessibility label too', () => {
        render(<MessageList entries={withPassword} maskedIndexes={[3]} />);

        expect(screen.getByTestId('chat-message-3').props.accessibilityLabel).not.toContain('Str0ngP@ssw0rd!');
    });

    it('masks by index, so an unrelated turn with the same text is untouched', () => {
        const collision = [
            { role: 'user', message: 'Str0ngP@ssw0rd!' },
            { role: 'user', message: 'Str0ngP@ssw0rd!' },
        ];

        render(<MessageList entries={collision} maskedIndexes={[1]} />);

        expect(screen.getByTestId('chat-message-0')).toHaveTextContent('Str0ngP@ssw0rd!');
        expect(screen.getByTestId('chat-message-1')).toHaveTextContent(MASKED_MESSAGE);
    });

    it('masks nothing when no index is given', () => {
        render(<MessageList entries={transcript} />);

        expect(screen.queryByText(MASKED_MESSAGE)).toBeNull();
    });
});

describe('overflow (MSG-05)', () => {
    it('wraps long entries instead of truncating them', () => {
        const long = [{ role: 'assistant', message: 'x'.repeat(400) }];

        render(<MessageList entries={long} />);

        const bubble = screen.getByTestId('chat-message-0');
        const bubbleStyle = StyleSheet.flatten(bubble.props.style);

        // No numberOfLines means the Text wraps rather than ellipsising, and the
        // bubble is width-bounded so it cannot force the sheet to scroll sideways.
        expect(bubble.findByType('Text').props.numberOfLines).toBeUndefined();
        expect(bubbleStyle.maxWidth).toBe('85%');
    });

    it('renders every entry past the default virtualization batch', () => {
        // Regression: FlatList's default initialNumToRender of 10 silently dropped
        // the newest turns once a full conversation exceeded ten entries.
        const long = Array.from({ length: 14 }, (_entry, index) => ({
            role: index % 2 === 0 ? 'assistant' : 'user',
            message: `turn ${index}`,
        }));

        render(<MessageList entries={long} />);

        expect(screen.getByText('turn 13')).toBeTruthy();
        expect(screen.getByTestId('chat-message-13')).toBeTruthy();
    });

    it('does not scroll horizontally', () => {
        render(<MessageList entries={transcript} />);

        expect(screen.getByTestId('chat-transcript').props.horizontal).toBeFalsy();
    });
});

describe('audio cue for new assistant replies', () => {
    it('speaks a new assistant reply', () => {
        render(<MessageList entries={[{ role: 'assistant', message: 'Hello there' }]} />);

        expect(speak).toHaveBeenCalledWith('Hello there');
    });

    it('does not speak the same reply twice across rerenders', () => {
        const entries = [{ role: 'assistant', message: 'Hello there' }];
        const { rerender } = render(<MessageList entries={entries} />);
        speak.mockClear();

        rerender(<MessageList entries={entries} />);

        expect(speak).not.toHaveBeenCalled();
    });

    it('does not speak the user echoing their own turn', () => {
        render(
            <MessageList
                entries={[
                    { role: 'assistant', message: 'Hello there' },
                    { role: 'user', message: 'Alex Johnson' },
                ]}
            />
        );

        expect(speak).not.toHaveBeenCalledWith('Alex Johnson');
    });
});
