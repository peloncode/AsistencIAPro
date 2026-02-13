import { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { handleApiError } from "@/utils/handleApiError";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { facialAttendanceStudent } from "@/services/ia.service";
import {
  IconCameraOutline,
  IconCameraSwitch,
  IconCheck,
  IconDocumentText,
  IconRefresh,
  IconScanOutline,
  IconSearch,
} from "@/components/Icons";
import { CardStudentAssistant } from "@/components/CardStudentAssistant";
import EmptyState from "@/components/EmptyState";
import { StudentAttendance } from "@/types/type";
import { formatDateForApi } from "@/utils/date";
import { getReportByDate } from "@/services/subject.service";

function FacialAttendance() {
  const { id, materia, seccion } = useLocalSearchParams<{
    id: string;
    materia: string;
    seccion: string;
  }>();
  const [studentsAssist, setStudentsAssist] = useState<StudentAttendance[]>([]);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["15%", "60%", "85%"], []);
  const queryClient = useQueryClient();

  const todayDate = formatDateForApi(new Date());

  // Cargar asistencia existente del día
  const { data: existingAttendance, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["existing-attendance", id, todayDate],
    queryFn: () => getReportByDate({ id: id as string, date: todayDate }),
    select: (response) => response.data,
  });

  // Inicializar lista con estudiantes ya presentes del día
  useEffect(() => {
    if (existingAttendance?.detalles?.presentes) {
      const presentStudents: StudentAttendance[] =
        existingAttendance.detalles.presentes.map((item) => ({
          id: item.estudiante.id,
          nombres: item.estudiante.nombres,
          apellidos: item.estudiante.apellidos,
          cedula: item.estudiante.cedula,
          hora: new Date(item.hora_registro).toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          esPresente: true,
        }));
      setStudentsAssist(presentStudents);
    }
  }, [existingAttendance]);

  const { mutate: handleIdentifyMutation, isPending } = useMutation({
    mutationFn: async () => await handleIdentify(),
    onSuccess: (data) => {
      // Extraer información del estudiante de la respuesta
      const estudiante = data?.data?.estudiante;
      const asistencia = data?.data?.asistencia;

      if (estudiante && asistencia) {
        const nuevoEstudiante: StudentAttendance = {
          id: estudiante.id,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          cedula: estudiante.cedula,
          hora: new Date().toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          esPresente: asistencia.es_presente,
        };

        // Solo agregar si no existe ya en la lista
        setStudentsAssist((prev) => {
          const exists = prev.some((s) => s.id === nuevoEstudiante.id);
          if (exists) return prev;
          return [...prev, nuevoEstudiante];
        });
      }

      const studentName = `${estudiante.nombres} ${estudiante.apellidos}`;

      queryClient.invalidateQueries({ queryKey: ["reports", id] });

      Alert.alert(
        "¡Identificado!",
        `Asistencia registrada exitosamente para ${studentName}`,
        [
          {
            text: "Siguiente",
            onPress: () => handleRetake(),
          },
        ],
      );
    },
    onError: (error: any) => {
      handleApiError(error, "No se pudo identificar el rostro.");
    },
  });

  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("front");

  function toggleCameraFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  // Solicitar permisos al montar
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      if (photo) {
        setCapturedImage(photo.uri);
      }
    } catch (error) {
      console.error("Error al capturar foto:", error);
      Alert.alert("Error", "No se pudo capturar la foto. Intente de nuevo.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleIdentify = async () => {
    if (!capturedImage) return;

    const formData = new FormData();
    const filename = capturedImage.split("/").pop() || "face.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    // @ts-ignore
    formData.append("image", {
      uri: capturedImage,
      name: filename,
      type,
    });

    return await facialAttendanceStudent(id as string, formData);
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-white mt-4">Cargando cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-gray-900 items-center justify-center px-6">
        <Stack.Screen
          options={{
            title: "Reconocimiento Facial",
          }}
        />
        <IconCameraOutline />
        <Text className="text-white text-xl font-bold mt-6 text-center">
          Permiso de cámara requerido
        </Text>
        <Text className="text-gray-400 text-center mt-2 mb-6">
          Para tomar la asistencia, necesitamos acceso a la cámara.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-blue-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Permitir acceso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-gray-900 relative">
        <Stack.Screen
          options={{
            title: "Reconocimiento Facial",
          }}
        />

        <View className="flex-1">
          {/* Vista previa o cámara */}
          <View className="flex-1 relative">
            {capturedImage ? (
              <Image
                source={{ uri: capturedImage }}
                className="flex-1"
                resizeMode="cover"
                style={{ transform: [{ scaleX: facing === "front" ? -1 : 1 }] }}
              />
            ) : (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing={facing}
              />
            )}

            {!capturedImage && (
              <View className="absolute top-10 left-0 right-0 z-10">
                <View className="bg-black/50 mx-10 p-2 rounded-lg backdrop-blur-sm">
                  <Text className="text-white text-center text-lg font-medium">
                    {materia} - {seccion}
                  </Text>
                  <Text className="text-blue-300 text-center text-sm mt-1">
                    Centra el rostro del estudiante
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View className="bg-gray-900 px-6 pt-4 pb-36">
            {capturedImage ? (
              <View className="flex-row justify-center gap-4">
                <TouchableOpacity
                  onPress={handleRetake}
                  disabled={isPending}
                  className="flex-row items-center bg-gray-700 px-6 py-4 rounded-xl disabled:opacity-50"
                >
                  <IconRefresh />
                  <Text className="text-white font-bold ml-2 text-lg">
                    Reintentar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleIdentifyMutation()}
                  disabled={isPending}
                  className="flex-row items-center bg-blue-600 px-6 py-4 rounded-xl disabled:opacity-50"
                >
                  {isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <IconSearch />
                  )}
                  <Text className="text-white font-bold ml-2 text-lg">
                    {isPending ? "Procesando..." : "Identificar"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center justify-center gap-8">
                <TouchableOpacity
                  onPress={handleCapture}
                  disabled={isCapturing}
                >
                  <View className="w-20 h-20 rounded-full bg-white/30 justify-center items-center border-4 border-white">
                    {isCapturing ? (
                      <ActivityIndicator size="large" color="white" />
                    ) : (
                      <View className="w-[60px] h-[60px] rounded-full bg-white" />
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleCameraFacing}
                  className="bg-gray-800 p-4 rounded-full absolute right-0"
                >
                  <IconCameraSwitch />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* BOTTOM SHEET FLOTANTE */}
        {/* React Native Bottom Sheet está diseñado para flotar sobre el contenido
            sin necesidad de zIndex manual y complejo si lo ponemos al final */}
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          backgroundStyle={{ backgroundColor: "#1f2937", borderRadius: 30 }}
          handleIndicatorStyle={{ backgroundColor: "#6b7280", width: 50 }}
          enablePanDownToClose={false}
        >
          <View className="flex-1">
            {/* Header del BottomSheet */}
            <View className="px-4 pb-3 border-b border-gray-700">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <IconCheck size={20} color="#22c55e" />

                  <Text className="text-white font-bold text-lg ml-2">
                    Asistentes ({studentsAssist.length})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    router.push(
                      `/section/${id}/details-attendance?materia=${materia}&seccion=${seccion}&date=${formatDateForApi(
                        new Date(),
                      )}`,
                    );
                  }}
                  className="flex-row items-center bg-blue-600 px-4 py-2 rounded-full disabled:opacity-50"
                >
                  <IconDocumentText />
                  <Text className="text-white font-bold ml-2">Ver Resumen</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contenido scrolleable */}
            <BottomSheetScrollView
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 10,
                flexGrow: 1,
              }}
            >
              {isLoadingExisting ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text className="text-gray-400 mt-3">
                    Cargando asistencia del día...
                  </Text>
                </View>
              ) : studentsAssist.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                  <EmptyState
                    icon={<IconScanOutline size={48} />}
                    title="Lista de asistencia vacía"
                    description="Escanea rostros para comenzar a llenar la lista de asistencia."
                  />
                </View>
              ) : (
                studentsAssist.map((estudiante) => (
                  <CardStudentAssistant
                    key={estudiante.id}
                    estudiante={estudiante}
                  />
                ))
              )}
            </BottomSheetScrollView>
          </View>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

export default FacialAttendance;
