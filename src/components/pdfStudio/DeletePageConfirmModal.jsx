import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

export const DeletePageConfirmModal = ({
  isOpen,
  onClose,
  targetCount = 1,
  onConfirmDelete
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${targetCount === 1 ? 'Page' : `${targetCount} Pages`}`}
      subtitle="Are you sure you want to remove the selected page(s) from your document workspace?"
      maxWidth="max-w-md"
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => {
              onConfirmDelete();
              onClose();
            }}
          >
            Delete {targetCount === 1 ? 'Page' : `${targetCount} Pages`}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">This action will modify your active document pages.</p>
          <p className="text-gray-400">
            {targetCount === 1 
              ? 'The selected page will be removed. Page numbers will update automatically.' 
              : `All ${targetCount} selected pages will be removed. Total page count and order will update immediately.`}
          </p>
        </div>
      </div>
    </Modal>
  );
};
