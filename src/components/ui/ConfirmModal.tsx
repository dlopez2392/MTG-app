"use client";

import Modal from "./Modal";
import Button from "./Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-body text-text-secondary mb-5">{description}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} size="sm" onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
