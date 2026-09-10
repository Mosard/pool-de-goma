"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { markNotificationReadAction } from "@/app/(dashboard)/actions";

export type NotificationItem = { id: string; title: string; body: string };

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <Bell size={18} strokeWidth={1.75} />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            {notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {notifications.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">Aucune notification.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <form action={markNotificationReadAction.bind(null, n.id)}>
                    <button type="submit" className="w-full rounded-lg p-2 text-left text-sm hover:bg-gray-50">
                      <p className="font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500">{n.body}</p>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
