import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

class SupabaseService {
    /**
     * AUTHENTICATION
     */
    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        return { data, error };
    }

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    }

    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    }

    async getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    /**
     * CHAT HISTORY
     */
    async getChats() {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .order('created_at', { ascending: false });
        return { data, error };
    }

    async createChat(name, description) {
        const user = await this.getUser();
        if (!user) return { error: 'Not authenticated' };

        const { data, error } = await supabase
            .from('chats')
            .insert([{ user_id: user.id, name, description }])
            .select()
            .single();
        return { data, error };
    }

    async updateChat(chatId, updates) {
        const { data, error } = await supabase
            .from('chats')
            .update(updates)
            .eq('id', chatId)
            .select()
            .single();
        return { data, error };
    }

    async deleteChat(chatId) {
        const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId);
        return { error };
    }

    /**
     * MESSAGES
     */
    async getMessages(chatId) {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });
        return { data, error };
    }

    async saveMessage(chatId, role, content, metadata = {}) {
        const { data, error } = await supabase
            .from('messages')
            .insert([{ chat_id: chatId, role, content, metadata }])
            .select()
            .single();
        return { data, error };
    }
}

export const supabaseService = new SupabaseService();
