interface BottomHintProps {
  message: string;
  visible: boolean;
}

export function BottomHint({ message, visible }: BottomHintProps) {
  return (
    <div
      className={`bottom-hint${visible ? ' show' : ''}`}
      id="bottom-hint"
    >
      {message}
    </div>
  );
}
