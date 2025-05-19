import { supabase } from '@/lib/supabase';
import React from 'react';

async function getPosts() {
  // This is a hypothetical example.
  // A real implementation would depend on your actual Supabase schema.
  const { data, error } = await supabase.from('posts').select('*');

  if (error) {
    console.error('Error fetching posts:', error);
    // In a real app, you might throw the error to be caught by an error boundary
    // or return a specific error state.
    return { error: error.message, data: [] };
  }
  return { error: null, data: data || [] };
}

export default async function ExampleDataPage() {
  const { error, data: posts } = await getPosts();

  if (error) {
    return (
      
        <h1>Error Fetching Data</h1>
        <p>{error}</p>
        <p>Please ensure your Supabase instance is correctly set up, the 'posts' table exists, and RLS policies allow access.</p>
      
    );
  }

  if (!posts || posts.length === 0) {
    return (
      
        <h1>No Posts Found</h1>
        <p>There are no posts to display. This could be because the 'posts' table is empty or not accessible.</p>
      
    );
  }

  return (
    
      <h1>Posts</h1>
      
        {posts.map((post: any) => ( // Using 'any' for post type as schema is unknown
          
            <h2>{post.title || 'Untitled Post'}</h2>
            <p>{post.content || 'No content'}</p>
          
        ))}
      
    
  );
}