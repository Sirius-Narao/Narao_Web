import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;

        if (!file || !userId) {
            return NextResponse.json(
                { error: 'Missing file or userId' },
                { status: 400 }
            );
        }

        // Validate file type (only JPEG and PNG)
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Only JPEG and PNG images are allowed.' },
                { status: 400 }
            );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File size exceeds 5MB limit' },
                { status: 400 }
            );
        }

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'jpg';
        const filename = `${uuidv4()}.${ext}`;
        const path = `${userId}/${filename}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('note-images')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json(
                { error: `Failed to upload image: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Get public URL
        const { data } = supabase.storage
            .from('note-images')
            .getPublicUrl(path);

        return NextResponse.json({
            url: data.publicUrl,
            path: path
        });

    } catch (error) {
        console.error('Upload endpoint error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
