<script setup lang="ts">
const user = useSupabaseUser()

watch(
  user,
  (value) => {
    if (value) navigateTo('/')
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <p class="text-sm text-gray-500">Confirming…</p>
  </div>
</template>
