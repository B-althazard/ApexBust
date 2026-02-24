export default function Modal({ title, children, actions, onClose }: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onClick={(e) => {
      if (e.target === e.currentTarget && onClose) onClose();
    }}>
      <div className="modal">
        <div className="h1">{title}</div>
        <div>{children}</div>
        {actions ? <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>{actions}</div> : null}
      </div>
    </div>
  );
}
