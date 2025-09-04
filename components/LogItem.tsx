
import React from 'react';
import { LogEntry, LogStatus } from '../types';

const statusConfig = {
    [LogStatus.INFO]: {
        icon: 'ℹ️',
        color: 'text-sky-400',
    },
    [LogStatus.SUCCESS]: {
        icon: '✅',
        color: 'text-green-400',
    },
    [LogStatus.ERROR]: {
        icon: '❌',
        color: 'text-red-400',
    },
    [LogStatus.WARNING]: {
        icon: '⚠️',
        color: 'text-yellow-400',
    },
     [LogStatus.PENDING]: {
        icon: '⏳',
        color: 'text-slate-400',
    }
};

export const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
    const config = statusConfig[log.status];

    return (
        <div className="flex items-start gap-3 p-2 text-base font-mono border-b border-slate-800">
            <div className="flex-shrink-0">{config.icon}</div>
            <div className={`flex-shrink-0 ${config.color} font-bold`}>[{log.status}]</div>
            <div className="flex-1 text-slate-300 whitespace-pre-wrap break-words">{log.message}</div>
            <div className="text-slate-500">{log.timestamp}</div>
        </div>
    );
};
