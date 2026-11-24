import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NoticeKey, zh } from '@navigation/core';
import { useNavigationStore } from '../store';

/** 与 Tauri toast 对齐的轻量提示条；3 秒后自动清除，不阻塞地图操作。 */
export function NoticeBanner() {
  const notice = useNavigationStore((state) => state.notice);
  const setNotice = useNavigationStore((state) => state.setNotice);
  const [visible, setVisible] = useState<NoticeKey>(NoticeKey.NONE);

  useEffect(() => {
    if (notice === NoticeKey.NONE) return;
    setVisible(notice);
    const timer = setTimeout(() => {
      setVisible(NoticeKey.NONE);
      setNotice(NoticeKey.NONE);
    }, 3000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  if (visible === NoticeKey.NONE) return null;
  const text = (zh.notice as Record<string, string>)[visible] ?? '';

  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 104,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.92)',
  },
  text: { color: '#f8fafc', fontSize: 13, textAlign: 'center' },
});
