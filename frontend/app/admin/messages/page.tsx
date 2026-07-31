"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import { Shimmer, TableSkeleton } from "@/components/ui/shimmer";
import { Button } from "@/components/ui/button";
import { Trash2, Mail } from "lucide-react";

interface Inquiry {
  id: string;
  property_title?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  created_at: string;
}

interface ContactMsg {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function AdminMessagesPage() {
  const queryClient = useQueryClient();

  const { data: inquiries = [], isLoading: loadingInquiries } = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: adminService.inquiries,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: adminService.messages,
  });

  const deleteInquiry = useMutation({
    mutationFn: adminService.deleteInquiry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] }),
  });

  const deleteMessage = useMutation({
    mutationFn: adminService.deleteMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const markRead = useMutation({
    mutationFn: adminService.markMessageRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  if (loadingInquiries || loadingMessages) {
    return (
      <div>
        <Shimmer className="h-8 w-48 mb-6" />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-6">Property Inquiries</h2>
        <p className="text-sm text-gray-500 mb-4">Messages sent from property detail pages with email and phone.</p>
        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          {(inquiries as Inquiry[]).length === 0 ? (
            <p className="p-8 text-center text-gray-500">No property inquiries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-navy-800 border-b">
                <tr>
                  <th className="text-left p-4">Property</th>
                  <th className="text-left p-4">Contact</th>
                  <th className="text-left p-4">Message</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(inquiries as Inquiry[]).map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{item.property_title || "—"}</td>
                    <td className="p-4">
                      <div>{item.name}</div>
                      <a href={`mailto:${item.email}`} className="text-gold-600 text-xs">{item.email}</a>
                      {item.phone && <div className="text-xs text-gray-500">{item.phone}</div>}
                    </td>
                    <td className="p-4 text-gray-600 max-w-xs">{item.message}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => deleteInquiry.mutate(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        aria-label="Delete inquiry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-6">Contact Messages</h2>
        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          {(messages as ContactMsg[]).length === 0 ? (
            <p className="p-8 text-center text-gray-500">No contact messages yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-navy-800 border-b">
                <tr>
                  <th className="text-left p-4">From</th>
                  <th className="text-left p-4">Subject</th>
                  <th className="text-left p-4">Message</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(messages as ContactMsg[]).map((msg) => (
                  <tr key={msg.id} className={`border-b last:border-0 ${!msg.is_read ? "bg-gold-50/30" : ""}`}>
                    <td className="p-4">
                      <div className="font-medium">{msg.name}</div>
                      <a href={`mailto:${msg.email}`} className="text-gold-600 text-xs">{msg.email}</a>
                      {msg.phone && <div className="text-xs text-gray-500">{msg.phone}</div>}
                    </td>
                    <td className="p-4">{msg.subject || "—"}</td>
                    <td className="p-4 text-gray-600 max-w-xs">{msg.message}</td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      {!msg.is_read && (
                        <Button size="sm" variant="outline" onClick={() => markRead.mutate(msg.id)} className="rounded-full">
                          <Mail className="w-3 h-3" /> Mark read
                        </Button>
                      )}
                      <button type="button" onClick={() => deleteMessage.mutate(msg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
