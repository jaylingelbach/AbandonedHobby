import * as React from 'react';

type UiCardProps = {
  title: string;
  children?: React.ReactNode;
  className?: string;
};

export function UiCard({ title, children, className }: UiCardProps) {
  return (
    <div className={['ah-card', className].filter(Boolean).join(' ')}>
      <div className="ah-card-header">
        <h3 className="ah-card-title">{title}</h3>
      </div>
      <div className="ah-card-body">{children}</div>
    </div>
  );
}

export default UiCard;
