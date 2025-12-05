import { useState, useEffect } from "react";
import sofiSinPiensa from "@/assets/sofi_sin_piensa.png";
import sofiPiensa from "@/assets/sofi_piensa.png";

export const SofiaThinking = () => {
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsThinking((prev) => !prev);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
      <img
        src={sofiSinPiensa}
        alt="Sofia"
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
          isThinking ? "opacity-0" : "opacity-100"
        }`}
      />
      <img
        src={sofiPiensa}
        alt="Sofia pensando"
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
          isThinking ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};
